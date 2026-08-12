import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { renderMarkdown } from './markdown';
import { blogCategoryEnum } from './db/schema';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import type { AdminBlogPost } from './db/blog';

export { renderMarkdown };

// The only read path pages and components may use for blog content
// (AGENTS.md). Reads content/blog's successor, blog_posts, through
// lib/db/blog.ts — never directly, and never from a page other than this
// module and the admin tree that has already established a session.

/**
 * The only shape a blog slug may have. Kept even though a slug no longer
 * becomes a filesystem path (it did under Väg A) — it is still untrusted
 * input echoed into canonical URLs, JSON-LD and the sitemap, so the same safe
 * set is asserted rather than assumed.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BlogCategory = (typeof blogCategoryEnum)[number];

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  publishedAt: string;
  updatedAt: string;
  status: 'draft' | 'published';
  coverUrl: string | null;
  coverAlt: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  relatedCategory?: string;
  relatedCity?: string;
};

export type BlogPost = BlogPostMeta & { html: string };

/**
 * Lazy import: lib/image-storage.ts throws if IMAGE_STORAGE_DRIVER is unset,
 * and the public site must keep rendering (with no cover) on a deploy where
 * images aren't configured yet.
 */
async function resolveCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    const { imagePublicUrl } = await import('./image-storage');
    return imagePublicUrl(key);
  } catch {
    return null;
  }
}

async function toMeta(row: AdminBlogPost): Promise<BlogPostMeta> {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status,
    coverUrl: await resolveCoverUrl(row.coverImageKey),
    coverAlt: row.coverAlt,
    coverWidth: row.coverWidth,
    coverHeight: row.coverHeight,
    relatedCategory: row.relatedCategory ?? undefined,
    relatedCity: row.relatedCity ?? undefined,
  };
}

async function toPost(row: AdminBlogPost): Promise<BlogPost> {
  const meta = await toMeta(row);
  return { ...meta, html: renderMarkdown(row.body) };
}

async function queryPublishedPosts(): Promise<BlogPostMeta[]> {
  const { listAdminBlogPosts } = await import('./db/blog');
  const rows = await listAdminBlogPosts({ status: 'published' });
  const metas = await Promise.all(rows.map(toMeta));
  return metas.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

async function queryPublishedPost(slug: string): Promise<BlogPost | null> {
  const { getAdminBlogPostBySlug } = await import('./db/blog');
  const row = await getAdminBlogPostBySlug(slug);
  if (!row || row.status !== 'published') return null;
  return toPost(row);
}

// unstable_cache + revalidateTag(CACHE_TAGS.blog) is the same read-path
// pattern as lib/db/queries.ts uses for jobs (see the long comment there for
// why: no `fetch` to hang `next: revalidate` on, and freshness after a write
// comes from invalidateBlogContent(), not this timer). cachedOrRaw() falls
// back to the uncached query outside a Next request/build — scripts/
// verify-blog.ts runs these under plain tsx, where unstable_cache throws.
const cacheOptions = { revalidate: PUBLIC_CACHE_TTL_SECONDS, tags: [CACHE_TAGS.blog] };
const cachedPosts = unstable_cache(queryPublishedPosts, ['db', 'blog', 'list'], cacheOptions);
const cachedPost = unstable_cache(queryPublishedPost, ['db', 'blog', 'detail'], cacheOptions);

async function cachedOrRaw<T>(cached: () => Promise<T>, raw: () => Promise<T>): Promise<T> {
  try {
    return await cached();
  } catch (err) {
    if (err instanceof Error && err.message.includes('incrementalCache missing')) {
      return raw();
    }
    throw err;
  }
}

/**
 * Unlike jobs (lib/data.ts's DATA_SOURCE=seed/db seam), the blog has no seed
 * fallback — it always reads blog_posts. `next build` prerenders /blog and
 * /blog/[slug] (both are static with a revalidate timer), which would fail
 * the whole build the first time it runs with no DATABASE_URL configured yet
 * (CI, a fresh deploy before migrations ran). NEXT_PHASE is Next's own
 * documented way to detect that specific window — this does NOT apply at
 * request time in production, where a missing DATABASE_URL must keep
 * throwing loudly (AGENTS.md: no default on purpose).
 */
function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

async function duringBuildReturnOnMissingDb<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isProductionBuildPhase() && err instanceof Error && err.message.includes('DATABASE_URL')) {
      return fallback;
    }
    throw err;
  }
}

export async function getBlogPosts(): Promise<BlogPostMeta[]> {
  return duringBuildReturnOnMissingDb(
    () => cachedOrRaw(() => cachedPosts(), () => queryPublishedPosts()),
    [],
  );
}

export async function getBlogSlugs(): Promise<string[]> {
  const posts = await getBlogPosts();
  return posts.map((p) => p.slug);
}

/** Published only — the public read. */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  return duringBuildReturnOnMissingDb(
    () => cachedOrRaw(() => cachedPost(slug), () => queryPublishedPost(slug)),
    null,
  );
}

/**
 * Whether the current session may preview a draft at its real URL. A draft
 * is otherwise indistinguishable from a slug that doesn't exist — 404 for
 * everyone else, deny by default.
 */
export function canPreviewDraft(role: string | null): boolean {
  return role === 'admin' || role === 'editor';
}

/**
 * Draft preview path: any status, but only for an authenticated admin/editor.
 * Returns null for anonymous visitors and for candidates/employers — the
 * caller (app/blog/[slug]/page.tsx) treats null exactly like "not found".
 */
export async function getBlogPostForPreview(slug: string): Promise<BlogPost | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  // Lazy: lib/auth.ts imports next/navigation, which scripts/verify-blog.ts
  // (plain tsx, no App Router runtime) cannot load statically — same reason
  // lib/db/blog.ts is imported lazily throughout this file.
  const { getSessionUser } = await import('./auth');
  const user = await getSessionUser();
  if (!canPreviewDraft(user?.role ?? null)) return null;
  const { getAdminBlogPostBySlug } = await import('./db/blog');
  const row = await getAdminBlogPostBySlug(slug);
  if (!row) return null;
  return toPost(row);
}

// ---------------------------------------------------------------------------
// Validation shared by the admin write routes and scripts/verify-blog.ts.
// Pure functions — no DB, no Next runtime — so the test asserts the exact
// logic the routes run instead of a copy of it.
// ---------------------------------------------------------------------------

/** coverAlt is required whenever a cover is set — rejected on empty/whitespace. */
export function validateCoverAlt(coverImageKey: string | null, coverAlt: string | null): boolean {
  if (!coverImageKey) return true;
  return typeof coverAlt === 'string' && coverAlt.trim().length > 0;
}

/**
 * A published slug cannot change — not "requires confirmation" like jobs,
 * a hard block (§12.5, owner-confirmed). `wasEverPublished` covers a post
 * that was unpublished back to draft: the URL was live once, so it stays
 * immutable.
 */
export function isSlugChangeAllowed(
  wasEverPublished: boolean,
  currentSlug: string,
  requestedSlug: string,
): boolean {
  if (currentSlug === requestedSlug) return true;
  return !wasEverPublished;
}

// ---------------------------------------------------------------------------
// JSON-LD builders (§12.6 D5). Pure functions so scripts/verify-blog.ts
// asserts the exact object the page emits, not a copy of its shape, and so
// app/blog/[slug]/page.tsx has one place to get this from.
// ---------------------------------------------------------------------------

export function buildBlogPostingJsonLd(post: BlogPost, siteUrl: string): Record<string, unknown> {
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: postUrl,
    image: post.coverUrl ?? `${postUrl}/opengraph-image`,
    author: { '@type': 'Organization', name: 'trabajo.com.py' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
  };
}

export function buildBlogBreadcrumbJsonLd(post: BlogPost, siteUrl: string): Record<string, unknown> {
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  };
}

export const blogPostInputSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(1).max(200).regex(SLUG_PATTERN, 'Slug inválido (minúsculas, números y guiones).'),
  description: z.string().min(1).max(160),
  category: z.enum(blogCategoryEnum),
  body: z.string().min(1),
  status: z.enum(['draft', 'published']),
  relatedCategory: z.string().max(100).nullable().optional(),
  relatedCity: z.string().max(100).nullable().optional(),
});
