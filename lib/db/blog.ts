// Admin reads and mutations for /admin/blog and /api/admin/blog/*.
//
// Mirrors lib/db/admin.ts's shape for jobs: `db` is imported lazily so this
// module stays reachable from the admin route tree even when DATA_SOURCE=seed
// and DATABASE_URL is unset — a static import would break `next build`'s
// page-data collection for the public site.
//
// lib/blog.ts is the ONLY module public pages and components may read from.
// This file is for callers that have already established a session (an
// /admin/blog page or an /api/admin/blog/* route handler) — see AGENTS.md.
import 'server-only';

import { and, desc, eq, ne } from 'drizzle-orm';
import { blogCategoryEnum, blogPosts, blogStatusEnum } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type BlogStatus = (typeof blogStatusEnum)[number];
export type BlogCategoryValue = (typeof blogCategoryEnum)[number];

export type AdminBlogPost = {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: BlogCategoryValue;
  body: string;
  coverImageKey: string | null;
  coverAlt: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  status: BlogStatus;
  relatedCategory: string | null;
  relatedCity: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const SELECT_COLUMNS = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  title: blogPosts.title,
  description: blogPosts.description,
  category: blogPosts.category,
  body: blogPosts.body,
  coverImageKey: blogPosts.coverImageKey,
  coverAlt: blogPosts.coverAlt,
  coverWidth: blogPosts.coverWidth,
  coverHeight: blogPosts.coverHeight,
  status: blogPosts.status,
  relatedCategory: blogPosts.relatedCategory,
  relatedCity: blogPosts.relatedCity,
  publishedAt: blogPosts.publishedAt,
  createdAt: blogPosts.createdAt,
  updatedAt: blogPosts.updatedAt,
} as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type AdminBlogFilters = { status?: BlogStatus };

/** Newest first, per the admin list requirement. */
export async function listAdminBlogPosts(filters: AdminBlogFilters = {}): Promise<AdminBlogPost[]> {
  const db = await getDb();
  const where = filters.status ? eq(blogPosts.status, filters.status) : undefined;
  return db.select(SELECT_COLUMNS).from(blogPosts).where(where).orderBy(desc(blogPosts.createdAt));
}

export async function getAdminBlogPost(id: number): Promise<AdminBlogPost | null> {
  const db = await getDb();
  const rows = await db.select(SELECT_COLUMNS).from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Any status — the draft-preview path goes through this, never the public one. */
export async function getAdminBlogPostBySlug(slug: string): Promise<AdminBlogPost | null> {
  const db = await getDb();
  const rows = await db.select(SELECT_COLUMNS).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
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
// Writes
// ---------------------------------------------------------------------------

export type BlogPostWrite = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategoryValue;
  body: string;
  coverImageKey: string | null;
  coverAlt: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  status: BlogStatus;
  relatedCategory: string | null;
  relatedCity: string | null;
};

export async function createBlogPost(data: BlogPostWrite, userId: number): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const result = await db.insert(blogPosts).values({
    ...data,
    publishedAt: data.status === 'published' ? now : null,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  });
  return Number(result[0].insertId);
}

/**
 * `wasPublished` tells this function whether publishedAt should already be
 * set — it stamps publishedAt the first time status becomes 'published' and
 * never touches it again, so re-editing a published post does not bump its
 * original publish date.
 */
export async function updateBlogPost(
  id: number,
  data: BlogPostWrite,
  userId: number,
  options: { wasPublished: boolean; publishedAt: Date | null },
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const publishedAt =
    data.status === 'published'
      ? (options.wasPublished ? options.publishedAt : now)
      : options.publishedAt;

  await db
    .update(blogPosts)
    .set({ ...data, publishedAt, updatedBy: userId, updatedAt: now })
    .where(eq(blogPosts.id, id));
}

export async function deleteBlogPost(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}
