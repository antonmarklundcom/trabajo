// Blog reads and writes. The only module that touches blog_posts and
// blog_post_redirects (PLAN-PHASE3-DRAFT.md §11).
//
// Two audiences in one file, split by the divider below, and the split is the
// point: every public read goes through publishedPredicate(), and no admin
// function is reachable from a public page. That mirrors the arrangement
// AGENTS.md requires of the job catalog — one visibility predicate, applied in
// one place — rather than repeating `status = 'published'` at each call site
// where forgetting it would quietly publish a draft.
//
// `db` is imported lazily (like lib/db/admin.ts and lib/auth.ts): lib/db/index.ts
// opens its pool at module-evaluation time, and this module is reachable from
// the public /blog tree during `next build`, where DATABASE_URL is not set.
import 'server-only';

import { and, count, desc, eq, isNotNull, isNull, like, lte, ne, or, sql } from 'drizzle-orm';
import { activityLog, blogPosts, blogPostRedirects } from './schema';
import { deleteImage } from '../image-storage';
import { isReservedBlogSlug, type BlogCategory } from '../blog-categories';

async function getDb() {
  return (await import('./index')).db;
}

async function logActivity(
  actorUserId: number,
  entityId: number,
  action: string,
  meta?: Record<string, unknown>,
) {
  const db = await getDb();
  await db.insert(activityLog).values({
    actorUserId,
    entityType: 'blog_post',
    entityId,
    action,
    meta: meta ?? null,
    createdAt: new Date(),
  });
}

export type BlogPostRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  category: (typeof blogPosts.category.enumValues)[number];
  status: (typeof blogPosts.status.enumValues)[number];
  coverImageKey: string | null;
  coverAlt: string | null;
  relatedCategorySlug: string | null;
  relatedCitySlug: string | null;
  publishedAt: string | null;
  authorUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Public reads — every one of them behind the single predicate
// ---------------------------------------------------------------------------

/**
 * Today's date in Paraguay, `YYYY-MM-DD`.
 *
 * The one clock the blog uses, for both halves of scheduled publishing: the
 * write path stamps it on a post published without a date, and
 * publishedPredicate() compares against it. They must agree — if the stamp
 * were a UTC date and the predicate a Paraguayan one, a post published at
 * 22:00 in Asunción (01:00 UTC the next day) would be stamped "tomorrow" and
 * stay hidden until midnight. Computed here rather than with MySQL's
 * CURDATE() so it does not depend on the database server's time zone, which
 * this app does not control on Hostinger.
 */
export function paraguayToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * The one definition of "the public may see this post".
 *
 * `publishedAt IS NOT NULL` is not redundant with the status check even though
 * the write path always sets a date when it publishes: publishedAt is what
 * orders the list and what `datePublished` claims in the article schema, so a
 * row that somehow lacks one (a hand-run UPDATE, a future import) must drop out
 * of the public site rather than surface as an article dated `null`.
 *
 * `publishedAt <= today` is scheduled publishing (PLAN-GROWTH.md §4 C3): a
 * post saved as published with a future date stays invisible until that day
 * in Paraguay. No column was added for it — the editorial date already exists
 * and is day-granular, which is the cadence a blog actually runs on. Nothing
 * has to fire on the day: every public read carries the 300 s TTL
 * (PUBLIC_CACHE_TTL_SECONDS), so the post appears within minutes of midnight
 * without a write to hook an invalidation onto.
 */
function publishedPredicate() {
  return and(
    eq(blogPosts.status, 'published'),
    isNotNull(blogPosts.publishedAt),
    lte(blogPosts.publishedAt, paraguayToday()),
  );
}

/**
 * Every column a listing needs — everything but the body. A list renders
 * titles and descriptions; selecting up to 60 KB of Markdown per row only to
 * drop it is the one cost this query shape can avoid for free.
 */
const listColumns = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  title: blogPosts.title,
  description: blogPosts.description,
  category: blogPosts.category,
  status: blogPosts.status,
  coverImageKey: blogPosts.coverImageKey,
  coverAlt: blogPosts.coverAlt,
  relatedCategorySlug: blogPosts.relatedCategorySlug,
  relatedCitySlug: blogPosts.relatedCitySlug,
  publishedAt: blogPosts.publishedAt,
  authorUserId: blogPosts.authorUserId,
  createdAt: blogPosts.createdAt,
  updatedAt: blogPosts.updatedAt,
};

export type BlogPostListRow = Omit<BlogPostRow, 'body'>;

/** Every published post, newest first — the sitemap and generateStaticParams. */
export async function queryPublishedPosts(): Promise<BlogPostListRow[]> {
  const db = await getDb();
  return db
    .select(listColumns)
    .from(blogPosts)
    .where(publishedPredicate())
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id)) as Promise<BlogPostListRow[]>;
}

/**
 * One page of the public list, or of one category's archive (`/blog`,
 * `/blog/categoria/[categoria]`). `total` counts under the same WHERE, so the
 * page count and the 404-past-the-last-page rule agree with the rows shown.
 */
export async function queryPublishedPostPage(options: {
  category?: BlogCategory;
  page: number;
  pageSize: number;
}): Promise<{ posts: BlogPostListRow[]; total: number }> {
  const db = await getDb();
  const where = options.category
    ? and(publishedPredicate(), eq(blogPosts.category, options.category))
    : publishedPredicate();

  const [posts, totals] = await Promise.all([
    db
      .select(listColumns)
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ total: count() }).from(blogPosts).where(where),
  ]);
  return { posts: posts as BlogPostListRow[], total: Number(totals[0]?.total ?? 0) };
}

/**
 * Published post count per category. The chips on /blog, the archive's
 * noindex-when-empty rule and the sitemap's archive entries all read this one
 * number, so they cannot disagree about which archives exist. A category with
 * no published post is simply absent from the result.
 */
export async function queryPublishedCategoryCounts(): Promise<
  Array<{ category: BlogCategory; total: number }>
> {
  const db = await getDb();
  const rows = await db
    .select({ category: blogPosts.category, total: count() })
    .from(blogPosts)
    .where(publishedPredicate())
    .groupBy(blogPosts.category);
  return rows.map((row) => ({ category: row.category, total: Number(row.total) }));
}

/**
 * "Artículos relacionados" under an article: same category first, then the
 * most recent of the rest, never the article itself. One query — the category
 * match is a sort key rather than a filter, so a category with a single post
 * still fills the block from the others.
 */
export async function queryRelatedPosts(
  excludeSlug: string,
  category: BlogCategory,
  limit: number,
): Promise<BlogPostListRow[]> {
  const db = await getDb();
  return db
    .select(listColumns)
    .from(blogPosts)
    .where(and(publishedPredicate(), ne(blogPosts.slug, excludeSlug)))
    .orderBy(
      sql`(${blogPosts.category} = ${category}) desc`,
      desc(blogPosts.publishedAt),
      desc(blogPosts.id),
    )
    .limit(limit) as Promise<BlogPostListRow[]>;
}

/**
 * Posts written for one job category (`relatedCategorySlug`), the sector guide
 * first — the linking surfaces on job pages and taxonomy landings
 * (PLAN-GROWTH.md §4 C2). The slug is compared, never joined to the job
 * taxonomy: the blog does not grow its own path into the job catalog.
 */
export async function queryPostsForJobCategory(
  relatedCategorySlug: string,
  limit: number,
): Promise<BlogPostListRow[]> {
  const db = await getDb();
  return db
    .select(listColumns)
    .from(blogPosts)
    .where(and(publishedPredicate(), eq(blogPosts.relatedCategorySlug, relatedCategorySlug)))
    .orderBy(
      sql`(${blogPosts.category} = 'guias-por-sector') desc`,
      desc(blogPosts.publishedAt),
      desc(blogPosts.id),
    )
    .limit(limit) as Promise<BlogPostListRow[]>;
}

export async function queryPublishedPost(slug: string): Promise<BlogPostRow | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), publishedPredicate()))
    .limit(1);
  return (row as BlogPostRow | undefined) ?? null;
}

/**
 * The slug a retired URL should 301 to, or null.
 *
 * Deliberately joins back through publishedPredicate(): a redirect into a post
 * that has since been unpublished must 404 like the post does, not bounce a
 * crawler to a URL that then 404s. One dead end is a fixable signal; a redirect
 * chain ending in a 404 is the one Search Console complains about.
 */
export async function queryRedirectTarget(fromSlug: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ slug: blogPosts.slug })
    .from(blogPostRedirects)
    .innerJoin(blogPosts, eq(blogPostRedirects.postId, blogPosts.id))
    .where(and(eq(blogPostRedirects.fromSlug, fromSlug), publishedPredicate()))
    .limit(1);
  return row?.slug ?? null;
}

// ---------------------------------------------------------------------------
// Admin reads and writes — /admin/blog and /api/admin/blog only
// ---------------------------------------------------------------------------

export type AdminBlogFilters = {
  status?: 'draft' | 'published';
  category?: BlogCategory;
  /** Only posts with neither related slug — the ones that link to no jobs. */
  unlinked?: boolean;
  q?: string;
};

export async function listAdminBlogPosts(filters: AdminBlogFilters = {}) {
  const db = await getDb();
  const where = [];
  if (filters.status) where.push(eq(blogPosts.status, filters.status));
  if (filters.category) where.push(eq(blogPosts.category, filters.category));
  if (filters.unlinked) {
    where.push(isNull(blogPosts.relatedCategorySlug), isNull(blogPosts.relatedCitySlug));
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    where.push(or(like(blogPosts.title, term), like(blogPosts.slug, term)));
  }

  return db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      category: blogPosts.category,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      coverImageKey: blogPosts.coverImageKey,
      relatedCategorySlug: blogPosts.relatedCategorySlug,
      relatedCitySlug: blogPosts.relatedCitySlug,
    })
    .from(blogPosts)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(blogPosts.updatedAt));
}

export async function getAdminBlogPost(id: number): Promise<BlogPostRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return (row as BlogPostRow | undefined) ?? null;
}

/** Every retired slug pointing at this post, newest first — shown in the editor. */
export async function listBlogRedirects(postId: number) {
  const db = await getDb();
  return db
    .select({ id: blogPostRedirects.id, fromSlug: blogPostRedirects.fromSlug, createdAt: blogPostRedirects.createdAt })
    .from(blogPostRedirects)
    .where(eq(blogPostRedirects.postId, postId))
    .orderBy(desc(blogPostRedirects.id));
}

/**
 * Is this slug taken — as a live post OR as a retired URL that already 301s
 * somewhere?
 *
 * Both halves matter. Reusing a retired slug for a different post would make
 * /blog/<slug> mean two things at once: the redirect table says "go here", the
 * posts table says "you are here". uniqueSlug() appends a suffix until this
 * returns false, so the collision is resolved before either row is written.
 */
export async function blogSlugExists(slug: string, excludeId?: number): Promise<boolean> {
  // A path segment the blog routes use for something else (`/blog/categoria/…`)
  // is never free: a post under it would be shadowed by, or shadow, a route.
  if (isReservedBlogSlug(slug)) return true;

  const db = await getDb();
  const [post] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(excludeId ? and(eq(blogPosts.slug, slug), sql`${blogPosts.id} <> ${excludeId}`) : eq(blogPosts.slug, slug))
    .limit(1);
  if (post) return true;

  const [redirect] = await db
    .select({ id: blogPostRedirects.id })
    .from(blogPostRedirects)
    .where(
      excludeId
        ? and(eq(blogPostRedirects.fromSlug, slug), sql`${blogPostRedirects.postId} <> ${excludeId}`)
        : eq(blogPostRedirects.fromSlug, slug),
    )
    .limit(1);
  return Boolean(redirect);
}

export type BlogPostInput = {
  slug: string;
  title: string;
  description: string;
  body: string;
  category: BlogPostRow['category'];
  status: BlogPostRow['status'];
  relatedCategorySlug: string | null;
  relatedCitySlug: string | null;
  publishedAt: string | null;
};

/**
 * A published post always has a date, whatever the form sent.
 *
 * Enforced here rather than in the route handler for the same reason
 * PLAN-PHASE2.md §6.1 keeps the employer re-approval rule inside
 * updateEmployerJob(): it is a property of the write, and a second caller
 * (an import script, a future bulk action) must not be able to skip it and
 * produce a row that publishedPredicate() then hides for reasons nobody can
 * see in the admin UI.
 */
function normalizePublishedAt(input: BlogPostInput): string | null {
  if (input.status !== 'published') return input.publishedAt;
  // paraguayToday(), not the UTC date: publishedPredicate() compares against
  // the same clock, and the two disagreeing would hide a post published late
  // in the evening until the next day.
  return input.publishedAt ?? paraguayToday();
}

/**
 * Does renaming a post from `previous` need a 301 from the old slug?
 *
 * Whenever the post was ever published — `previous.publishedAt` is not null —
 * not only while it is published right now (PLAN-GROWTH.md §4 C3, §3.7). The
 * first publish stamps the date and the editor carries it forward on every
 * later save, so published → unpublished → renamed → republished keeps its
 * 301, and the old URL was indexed and linked the whole time. The redirect is
 * inert while the post is not public (queryRedirectTarget() joins through
 * publishedPredicate()), so minting it early costs nothing. The one false
 * positive — a never-published draft someone typed a date on — mints a row
 * that is equally inert: the simplest rule that is never wrong in the
 * direction that loses a URL.
 */
export function shouldMintRedirect(
  previous: { slug: string; publishedAt: string | null },
  nextSlug: string,
): boolean {
  return nextSlug !== previous.slug && previous.publishedAt !== null;
}

export async function createBlogPost(input: BlogPostInput, actorUserId: number): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const [result] = await db.insert(blogPosts).values({
    ...input,
    publishedAt: normalizePublishedAt(input),
    authorUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  const id = Number(result.insertId);
  await logActivity(actorUserId, id, 'create', { slug: input.slug, status: input.status });
  return id;
}

/**
 * `previousSlug` is passed in by the caller, which has already resolved what
 * the new slug should be. When it differs and the post was publicly reachable
 * under the old one, the redirect is minted in the same call — the only moment
 * at which both values are still known.
 */
export async function updateBlogPost(
  id: number,
  input: BlogPostInput,
  actorUserId: number,
  previous: { slug: string; publishedAt: string | null },
): Promise<void> {
  const db = await getDb();

  if (input.slug !== previous.slug) {
    // Reclaiming a slug this same post used before: drop the stale redirect
    // rather than leave /blog/<slug> pointing at itself.
    await db.delete(blogPostRedirects).where(eq(blogPostRedirects.fromSlug, input.slug));

    // Only if the old URL was ever public. A never-published draft's slug was
    // never indexed and never linked, so a redirect for it would be dead
    // weight occupying a slug nothing else could use.
    if (shouldMintRedirect(previous, input.slug)) {
      await db.insert(blogPostRedirects).values({
        fromSlug: previous.slug,
        postId: id,
        createdAt: new Date(),
      });
    }
  }

  await db
    .update(blogPosts)
    .set({ ...input, publishedAt: normalizePublishedAt(input), updatedAt: new Date() })
    .where(eq(blogPosts.id, id));

  await logActivity(actorUserId, id, 'update', {
    slug: input.slug,
    status: input.status,
    slugChangedFrom: input.slug !== previous.slug ? previous.slug : undefined,
  });
}

/** Set or clear the cover. Callers upload/delete the object itself. */
export async function updateBlogCover(
  id: number,
  coverImageKey: string | null,
  coverAlt: string | null,
  actorUserId: number,
): Promise<void> {
  const db = await getDb();
  await db
    .update(blogPosts)
    .set({ coverImageKey, coverAlt, updatedAt: new Date() })
    .where(eq(blogPosts.id, id));
  await logActivity(actorUserId, id, coverImageKey ? 'cover_upload' : 'cover_remove');
}

/**
 * Hard delete: redirects first, then the stored cover object, then the row.
 *
 * The order is the no-FK convention's other half (AGENTS.md, verify-cascades.ts).
 * Dependents before parent so a crash in between loses a redirect rather than
 * orphaning one that no join can ever find again. The image object is removed
 * before the row for the same reason inverted: the key only exists in this row,
 * so deleting the row first would strand the WebP with nothing left pointing at
 * it. A failed object delete does not abort the row delete — one orphaned file
 * in the image store beats a post that cannot be removed.
 */
export async function deleteBlogPost(id: number, actorUserId: number): Promise<void> {
  const db = await getDb();
  const post = await getAdminBlogPost(id);

  await db.delete(blogPostRedirects).where(eq(blogPostRedirects.postId, id));

  if (post?.coverImageKey) {
    try {
      await deleteImage(post.coverImageKey);
    } catch (err) {
      console.error('[blog] failed to delete cover object', post.coverImageKey, err);
    }
  }

  await db.delete(blogPosts).where(eq(blogPosts.id, id));
  await logActivity(actorUserId, id, 'delete', { slug: post?.slug });
}
