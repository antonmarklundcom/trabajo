// Public blog reads (Väg B — database-backed, replacing the Väg A
// content/blog/*.md files). Mirrors lib/db/queries.ts's cached-read shape:
// this is the equivalent seam for blog content, the way lib/db/employer.ts is
// for employer data — per-content data with no seed representation goes
// straight to its own scoped read path (AGENTS.md), which is what this file
// is. Admin reads/writes go through lib/db/blog-admin.ts instead, same split
// as public queries.ts vs admin.ts for jobs.
//
// HTML safety: blogPosts.bodyHtml is sanitized ONCE, at write time
// (lib/blog-sanitize.ts, called from lib/db/blog-admin.ts). This file reads
// the stored value and renders it as-is — there is no second sanitize pass
// here, by design (see blog-sanitize.ts's header for why two passes would be
// worse than one). That is also why Väg B needed its own sanitizer at all
// when Väg A's PLAN-PHASE3-DRAFT.md §8.1 judged one unnecessary: Väg A's
// trust boundary was "committed to this git repo"; Väg B's is "written by an
// authenticated admin session", and a POST body is not a git diff.
import 'server-only';

import { unstable_cache } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { blogPosts, type blogCategoryEnum } from './db/schema';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import { imagePublicUrl } from './image-storage';

// Lazy, like lib/db/admin.ts's getDb() — lib/db/index.ts opens a connection
// pool at import time and throws without DATABASE_URL, which would make a
// static import break `next build`'s page-data collection whenever
// DATA_SOURCE=seed (no database configured at all, e.g. this repo's default
// dev setup). The blog has no seed source to fall back to — unlike
// lib/data.ts's job seam, DATA_SOURCE never applied to it.
async function getDb() {
  return (await import('./db')).db;
}

/**
 * app/blog/[slug]/page.tsx's generateStaticParams() calls getBlogSlugs()
 * unconditionally at build time — unlike job pages, there is no
 * DATA_SOURCE=seed fallback to fall back to, so an unset DATABASE_URL would
 * otherwise fail `next build` outright rather than just the blog. A build
 * with no database configured (this repo's default local/CI setup) treats
 * the blog as having zero published posts instead: no static blog pages get
 * generated, but the rest of the site still builds. Once DATABASE_URL is
 * set, every function below reads real data as normal — this guard only
 * short-circuits the "not configured at all" case.
 */
function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export type BlogCategory = (typeof blogCategoryEnum)[number];

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  publishedAt: string;
  updatedAt: string;
  coverImageUrl: string | null;
  relatedCategory?: string;
  relatedCity?: string;
};

export type BlogPost = BlogPostMeta & { html: string };

const cacheOptions = { revalidate: PUBLIC_CACHE_TTL_SECONDS, tags: [CACHE_TAGS.blog] };

function toIso(d: Date | null): string {
  return (d ?? new Date()).toISOString().slice(0, 10);
}

async function queryBlogPosts(): Promise<BlogPostMeta[]> {
  if (!hasDatabase()) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.published, true))
    .orderBy(desc(blogPosts.publishedAt));

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIso(row.updatedAt),
    coverImageUrl: row.featuredImageKey ? imagePublicUrl(row.featuredImageKey) : null,
    relatedCategory: row.relatedCategory ?? undefined,
    relatedCity: row.relatedCity ?? undefined,
  }));
}

async function querySlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const db = await getDb();
  const rows = await db
    .select({ slug: blogPosts.slug })
    .from(blogPosts)
    .where(eq(blogPosts.published, true));
  return rows.map((r) => r.slug);
}

async function queryBlogPost(slug: string): Promise<BlogPost | null> {
  if (!hasDatabase()) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIso(row.updatedAt),
    coverImageUrl: row.featuredImageKey ? imagePublicUrl(row.featuredImageKey) : null,
    relatedCategory: row.relatedCategory ?? undefined,
    relatedCity: row.relatedCity ?? undefined,
    html: row.bodyHtml,
  };
}

const cachedPosts = unstable_cache(queryBlogPosts, ['db', 'blog', 'list'], cacheOptions);
const cachedSlugs = unstable_cache(querySlugs, ['db', 'blog', 'slugs'], cacheOptions);
const cachedPost = unstable_cache(
  (slug: string) => queryBlogPost(slug),
  ['db', 'blog', 'detail'],
  cacheOptions,
);

export async function getBlogPosts(): Promise<BlogPostMeta[]> {
  return cachedPosts();
}

export async function getBlogSlugs(): Promise<string[]> {
  return cachedSlugs();
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return cachedPost(slug);
}
