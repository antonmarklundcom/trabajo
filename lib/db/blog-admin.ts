// Admin-side reads and mutations for /admin/blog and /api/admin/blog/*.
//
// Mirrors lib/db/admin.ts's job CRUD in shape (getDb() lazily, same
// slug/uniqueness discipline, same activity log), kept in its own file for
// the same reason employer/candidate reads have their own files: this is a
// distinct content type with its own lifecycle (draft/published, image
// ownership) and mixing it into admin.ts's already-large job/company/user
// surface would make that file the thing nobody wants to read in full.
import 'server-only';

import { and, desc, eq, ne } from 'drizzle-orm';
import { activityLog, blogPosts, users, type blogCategoryEnum } from './schema';
import { sanitizeBlogHtml, extractInlineImageKeys } from '../blog-sanitize';
import { deleteImage } from '../image-storage';

async function getDb() {
  return (await import('./index')).db;
}

type BlogCategory = (typeof blogCategoryEnum)[number];

/**
 * `slug` is the RESOLVED, already-unique slug — same contract as
 * lib/db/admin.ts's JobInput. Resolution (slugify + uniqueSlug + the
 * "published post, confirm the change" gate) happens in the Route Handler,
 * mirroring app/api/admin/empleos/[id]/route.ts exactly, so this file stays a
 * pure write path with no HTTP-shaped concerns (409s, confirmation flags) in
 * it.
 */
export type BlogPostInput = {
  title: string;
  slug: string;
  description: string;
  category: BlogCategory;
  /** Raw HTML from the Tiptap editor — sanitized inside createBlogPost/updateBlogPost. */
  bodyHtml: string;
  featuredImageKey: string | null;
  relatedCategory: string | null;
  relatedCity: string | null;
  published: boolean;
};

async function logActivity(
  actorUserId: number,
  action: string,
  entityId: number,
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

// ---------------------------------------------------------------------------
// List / read — admin sees every status, unlike lib/blog.ts's public reads.
// ---------------------------------------------------------------------------

export async function getAdminBlogPosts() {
  const db = await getDb();
  return db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      category: blogPosts.category,
      published: blogPosts.published,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.updatedAt));
}

export async function getAdminBlogPost(id: number) {
  const db = await getDb();
  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function blogSlugExists(slug: string, excludeId?: number): Promise<boolean> {
  const db = await getDb();
  const where = excludeId
    ? and(eq(blogPosts.slug, slug), ne(blogPosts.id, excludeId))
    : eq(blogPosts.slug, slug);
  const rows = await db.select({ id: blogPosts.id }).from(blogPosts).where(where).limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Sanitizes bodyHtml and re-derives the image-key ownership list from the
 * sanitized result — never from anything the client claims. Shared by create
 * and update so the two paths cannot drift.
 */
function prepareContent(input: BlogPostInput): {
  bodyHtml: string;
  imageKeys: string[];
} {
  const bodyHtml = sanitizeBlogHtml(input.bodyHtml);
  const imageKeys = extractInlineImageKeys(bodyHtml);
  if (input.featuredImageKey) imageKeys.push(input.featuredImageKey);
  return { bodyHtml, imageKeys: [...new Set(imageKeys)] };
}

export async function createBlogPost(
  input: BlogPostInput,
  actorUserId: number,
): Promise<number> {
  const db = await getDb();
  const { bodyHtml, imageKeys } = prepareContent(input);

  const now = new Date();
  const [result] = await db.insert(blogPosts).values({
    slug: input.slug,
    title: input.title,
    description: input.description,
    category: input.category,
    bodyHtml,
    featuredImageKey: input.featuredImageKey,
    imageKeys,
    relatedCategory: input.relatedCategory,
    relatedCity: input.relatedCity,
    published: input.published,
    publishedAt: input.published ? now : null,
    createdBy: actorUserId,
    updatedBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  const id = result.insertId;
  await logActivity(actorUserId, 'create', id, { slug: input.slug });
  return id;
}

export async function updateBlogPost(
  id: number,
  input: BlogPostInput,
  actorUserId: number,
): Promise<boolean> {
  const db = await getDb();
  const existing = await getAdminBlogPost(id);
  if (!existing) return false;

  const { bodyHtml, imageKeys } = prepareContent(input);

  // Images this edit dropped (removed inline, or replaced the featured
  // image) are no longer referenced by anything — delete the objects, same
  // "object first" discipline as PLAN-IMAGES.md §5's replace-a-logo case.
  // A failed delete here propagates and aborts the save, same asymmetry:
  // better to fail the edit than record a row pointing at a key we then
  // silently destroyed.
  const previousKeys = new Set(
    Array.isArray(existing.imageKeys) ? (existing.imageKeys as string[]) : [],
  );
  const nextKeys = new Set(imageKeys);
  const droppedKeys = [...previousKeys].filter((k) => !nextKeys.has(k));
  for (const key of droppedKeys) {
    await deleteImage(key);
  }

  const now = new Date();
  const wasPublished = existing.published;
  const [result] = await db
    .update(blogPosts)
    .set({
      slug: input.slug,
      title: input.title,
      description: input.description,
      category: input.category,
      bodyHtml,
      featuredImageKey: input.featuredImageKey,
      imageKeys,
      relatedCategory: input.relatedCategory,
      relatedCity: input.relatedCity,
      published: input.published,
      // Set on the FIRST transition into published, never overwritten after
      // — see the column comment in schema.ts.
      publishedAt: !wasPublished && input.published ? now : existing.publishedAt,
      updatedBy: actorUserId,
      updatedAt: now,
    })
    .where(eq(blogPosts.id, id));

  const changed = result.affectedRows > 0;
  if (changed) await logActivity(actorUserId, 'update', id, { slug: input.slug });
  return changed;
}

/**
 * Object storage first, row second — the CV/logo asymmetry (PLAN-IMAGES.md
 * §5): a row pointing at bytes that are gone renders one broken image; an
 * object with no row pointing at it is a file nobody can ever remove.
 */
export async function deleteBlogPost(id: number, actorUserId: number): Promise<boolean> {
  const db = await getDb();
  const existing = await getAdminBlogPost(id);
  if (!existing) return false;

  const keys = Array.isArray(existing.imageKeys) ? (existing.imageKeys as string[]) : [];
  for (const key of keys) {
    await deleteImage(key);
  }

  const [result] = await db.delete(blogPosts).where(eq(blogPosts.id, id));
  const changed = result.affectedRows > 0;
  if (changed) await logActivity(actorUserId, 'delete', id, { slug: existing.slug });
  return changed;
}

export async function getAdminBlogAuthorNames(): Promise<Map<number, string>> {
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name }).from(users);
  return new Map(rows.map((r) => [r.id, r.name]));
}
