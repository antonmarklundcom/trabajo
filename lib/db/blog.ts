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

import { and, desc, eq, isNotNull, like, or, sql } from 'drizzle-orm';
import { activityLog, blogPosts, blogPostRedirects } from './schema';
import { deleteImage } from '../image-storage';

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
 * The one definition of "the public may see this post".
 *
 * `publishedAt IS NOT NULL` is not redundant with the status check even though
 * the write path always sets a date when it publishes: publishedAt is what
 * orders the list and what `datePublished` claims in the article schema, so a
 * row that somehow lacks one (a hand-run UPDATE, a future import) must drop out
 * of the public site rather than surface as an article dated `null`.
 */
function publishedPredicate() {
  return and(eq(blogPosts.status, 'published'), isNotNull(blogPosts.publishedAt));
}

export async function queryPublishedPosts(): Promise<BlogPostRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(blogPosts)
    .where(publishedPredicate())
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id)) as Promise<BlogPostRow[]>;
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

export type AdminBlogFilters = { status?: 'draft' | 'published'; q?: string };

export async function listAdminBlogPosts(filters: AdminBlogFilters = {}) {
  const db = await getDb();
  const where = [];
  if (filters.status) where.push(eq(blogPosts.status, filters.status));
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
  return input.publishedAt ?? new Date().toISOString().slice(0, 10);
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
  previous: { slug: string; status: BlogPostRow['status'] },
): Promise<void> {
  const db = await getDb();

  if (input.slug !== previous.slug) {
    // Reclaiming a slug this same post used before: drop the stale redirect
    // rather than leave /blog/<slug> pointing at itself.
    await db.delete(blogPostRedirects).where(eq(blogPostRedirects.fromSlug, input.slug));

    // Only if the old URL was ever public. A draft's slug was never indexed and
    // never linked, so a redirect for it is a row that can only ever be dead
    // weight — and it would occupy a slug nothing else could use.
    if (previous.status === 'published') {
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
