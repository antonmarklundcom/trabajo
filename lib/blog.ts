import 'server-only';
import { unstable_cache } from 'next/cache';
import { marked } from 'marked';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import { cachedOrRaw } from './cached-or-raw';
import {
  queryPostsForJobCategory,
  queryPublishedCategoryCounts,
  queryPublishedPost,
  queryPublishedPostPage,
  queryPublishedPosts,
  queryRedirectTarget,
  queryRelatedPosts,
  type BlogPostListRow,
} from './db/blog';
import { imagePublicUrl } from './image-storage';
import { slugify } from './slug';
import { BLOG_PAGE_SIZE } from './pagination';
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COPY,
  blogCategoryPath,
  isBlogCategory,
  type BlogCategory,
} from './blog-categories';

// The only read path for blog content, exactly as it was when the content was
// Markdown files on disk (PLAN-PHASE3-DRAFT.md §7.2). No page, component or
// route may reach past it into lib/db/blog.ts, for the same reason it could not
// call node:fs before: the published-vs-draft rule and the Markdown rendering
// rules are properties of the read, and there must be one place where both are
// true.
//
// What changed on 2026-08-12 (§11) is only what sits behind this file. Väg A
// read content/blog/*.md; Väg B reads blog_posts. The exported signatures are
// unchanged, which is what §5.1 predicted when it said the migration was "en
// ändring i en fil" — this file, plus the cover-image fields the database can
// carry and frontmatter could not.

/**
 * The only shape a blog slug may have. It no longer becomes a filesystem path,
 * so this is no longer a traversal guard — but it is still the definition of a
 * URL this site is willing to mint, applied to admin input before a row is
 * written and to router input before a query is run. Rejecting early also keeps
 * a junk URL from reaching the database at all.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Raw HTML in an article is ESCAPED, not passed through and not dropped.
//
// This needs stating precisely, because the obvious assumption is wrong:
// `marked` passes raw HTML through verbatim by default and has had no
// `sanitize` option since v5. Without the renderer override below, a `<script>`
// in an article body reaches post.html and then dangerouslySetInnerHTML —
// verified, not assumed (scripts/verify-blog.ts asserts it on every push).
//
// Under Väg A the argument for escaping was hygiene rather than security:
// content was committed to this repo, so whoever could publish an article could
// already publish arbitrary React. That argument is GONE. Bodies now arrive
// through POST /api/admin/blog from a browser session, and §8.1 named this
// exact migration as the thing that must not silently inherit an HTML
// passthrough nobody realised was on. The author is still trusted — admin and
// editor accounts are staff — but "trusted" and "may inject script tags into
// every visitor's page" are different permissions, and a stolen editor session
// should not be able to spend one on the other.
//
// Escaping rather than dropping: nothing an author wrote disappears silently.
// A pasted `<div>` shows up as visible text, which is how the author finds out.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The other half of the same boundary (PLAN-PHASE3-DRAFT.md §12.1). Escaping
// raw HTML closes `<script>`; it does nothing about `[x](javascript:alert(1))`,
// which marked renders as a live anchor because a link destination is not HTML
// — it is a Markdown token that the renderer turns into an href. Same author,
// same session, same result in the visitor's browser.
//
// Only these schemes may reach an href or a src. `data:` is excluded from both:
// `data:text/html` is a script-execution vector in an anchor, and an inline
// image payload has no business in an article body when the image pipeline
// exists (PLAN-IMAGES.md). Relative and fragment URLs are same-origin and are
// always allowed.
const SAFE_LINK_SCHEMES = ['http:', 'https:', 'mailto:'];
const SAFE_IMAGE_SCHEMES = ['http:', 'https:'];

// Any absolute base works: it is never part of the output, it only lets the URL
// parser resolve relative hrefs so their scheme can be read. The parser is what
// does the real work here — it applies the WHATWG stripping rules, so the
// tab-and-newline dodges (`java\tscript:`) resolve to `javascript:` and are
// rejected rather than sneaking past a regex.
const SCHEME_PROBE_BASE = 'https://trabajo.com.py';

function hasSafeScheme(href: string, allowed: string[]): boolean {
  const trimmed = href.trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  try {
    return allowed.includes(new URL(trimmed, SCHEME_PROBE_BASE).protocol);
  } catch {
    // Unparseable is not safe.
    return false;
  }
}

marked.setOptions({ gfm: true });

/** One `##` heading of an article, for the "En esta nota" contents list. */
export type BlogHeading = { id: string; text: string };

// Per-render heading state. renderMarkdown() is synchronous (`async: false`),
// so one module-level slot cannot be shared by two renders at once; it is set
// right before marked.parse() and cleared right after.
let headingState: { seen: Map<string, number>; h2: BlogHeading[] } | null = null;

type InlineToken = { type?: string; text?: string; tokens?: InlineToken[] };

/** The visible text of a heading's inline tokens: `**Hola** \`x\`` → `Hola x`. */
function plainText(tokens: InlineToken[]): string {
  return tokens
    .map((token) => (token.tokens ? plainText(token.tokens) : (token.text ?? '')))
    .join('');
}

/**
 * A stable, unique fragment id for a heading. slugify() is the same function
 * that mints post slugs, so the id is always `[a-z0-9-]` — safe inside an
 * attribute without escaping, and incapable of carrying anything the escape
 * above would have to catch. Repeats get `-2`, `-3`, the way GitHub does it.
 */
function headingId(text: string): string {
  const base = slugify(text).slice(0, 80).replace(/-+$/, '');
  if (!base) return '';
  if (!headingState) return base;
  const n = (headingState.seen.get(base) ?? 0) + 1;
  headingState.seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

// One `use()` call, extending the renderer rather than replacing it. §13.4
// named the risk precisely: the raw-HTML escape below lives in this same
// object, and an override that replaces where it should extend would switch it
// off with nothing in CI noticing. The assertions in scripts/verify-blog.ts
// cover both properties together for that reason.
marked.use({
  renderer: {
    html(token) {
      return escapeHtml(typeof token === 'string' ? token : (token.raw ?? token.text ?? ''));
    },

    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      // Degrade to the link's own text rather than dropping it. Same reasoning
      // as escaping instead of stripping: the author sees that something did
      // not become a link, instead of the phrase silently vanishing.
      if (!hasSafeScheme(href, SAFE_LINK_SCHEMES)) return text;

      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href.trim())}"${titleAttr}>${text}</a>`;
    },

    // Heading ids for deep links and the contents list (PLAN-GROWTH.md §4 C2).
    // Added to this same renderer object, not a second marked.use(), for the
    // reason the comment above gives: the escape lives here.
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const text = plainText(tokens as InlineToken[]).trim();
      const id = headingId(text);
      if (id && depth === 2 && headingState) headingState.h2.push({ id, text });
      return id ? `<h${depth} id="${id}">${inner}</h${depth}>\n` : `<h${depth}>${inner}</h${depth}>\n`;
    },

    image({ href, title, text }) {
      // Alt text survives a rejected image for the same reason.
      if (!hasSafeScheme(href, SAFE_IMAGE_SCHEMES)) return escapeHtml(text);

      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href.trim())}" alt="${escapeHtml(text)}"${titleAttr} />`;
    },
  },
});

/**
 * The one place article Markdown becomes HTML. Exported so scripts/verify-blog.ts
 * asserts the configuration ABOVE rather than its own copy of `marked` — under
 * tsx's CJS transform a re-import can resolve to a second instance of the
 * library, which would make the test pass while the app still passed HTML
 * through. The test has to go through the same function the pages do.
 */
export function renderMarkdown(body: string): string {
  return renderArticle(body).html;
}

/** renderMarkdown() plus the article's `##` headings, in document order. */
export function renderArticle(body: string): { html: string; headings: BlogHeading[] } {
  headingState = { seen: new Map(), h2: [] };
  try {
    const html = marked.parse(body, { async: false });
    return { html, headings: headingState.h2 };
  } finally {
    headingState = null;
  }
}

/**
 * The contents list is shown only on a long article (≥4 `##` sections). Below
 * that, a list of two or three links above the text is clutter, not a map.
 */
export const TOC_MIN_HEADINGS = 4;

// Re-exported from the single source (C1) rather than defined here: this
// file is the public read path, but BlogPostForm.tsx ('use client') and
// lib/db/schema.ts (the enum) need the same tuple and cannot import this
// module — it starts with `import 'server-only'`.
export { BLOG_CATEGORIES, BLOG_CATEGORY_LABELS, BLOG_CATEGORY_COPY };
export type { BlogCategory };

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  /** Editorial date, YYYY-MM-DD. Never null on a post this module returns. */
  publishedAt: string;
  /** ISO timestamp of the last edit — `dateModified` and the sitemap. */
  updatedAt: string;
  relatedCategory?: string;
  relatedCity?: string;
  /** Absolute-path URL of the cover image, or undefined when there is none. */
  coverUrl?: string;
  coverAlt?: string;
};

export type BlogPost = BlogPostMeta & {
  html: string;
  /** The article's `##` headings, each with the id its <h2> carries. */
  headings: BlogHeading[];
};

/** `/img/blog/{uuid}.webp`. One function, so a storage move is one edit. */
export function blogCoverUrl(coverImageKey: string): string {
  return imagePublicUrl(coverImageKey);
}

export { blogCategoryPath, isBlogCategory, BLOG_PAGE_SIZE };

function toMeta(row: BlogPostListRow): BlogPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    publishedAt: row.publishedAt ?? '',
    // unstable_cache round-trips its return value through JSON, so on the
    // cached path row.updatedAt arrives as a string rather than a Date.
    updatedAt: new Date(row.updatedAt).toISOString(),
    relatedCategory: row.relatedCategorySlug ?? undefined,
    relatedCity: row.relatedCitySlug ?? undefined,
    coverUrl: row.coverImageKey ? blogCoverUrl(row.coverImageKey) : undefined,
    coverAlt: row.coverAlt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Caching — same arrangement and the same reasons as lib/db/queries.ts
// ---------------------------------------------------------------------------

const cacheOptions = { revalidate: PUBLIC_CACHE_TTL_SECONDS, tags: [CACHE_TAGS.blog] };

const cachedPosts = unstable_cache(() => queryPublishedPosts(), ['db', 'blog', 'list'], cacheOptions);
const cachedPost = unstable_cache(
  (slug: string) => queryPublishedPost(slug),
  ['db', 'blog', 'detail'],
  cacheOptions,
);
const cachedRedirect = unstable_cache(
  (slug: string) => queryRedirectTarget(slug),
  ['db', 'blog', 'redirect'],
  cacheOptions,
);
// unstable_cache folds the call's arguments into the key, so each
// (category, page) pair, each article's related list and each job category's
// posts is its own entry — a bounded set: seven categories, a page count that
// grows by one per twelve posts, one entry per article, ten job categories.
const cachedPostPage = unstable_cache(
  (category: BlogCategory | null, page: number) =>
    queryPublishedPostPage({ category: category ?? undefined, page, pageSize: BLOG_PAGE_SIZE }),
  ['db', 'blog', 'page'],
  cacheOptions,
);
const cachedCategoryCounts = unstable_cache(
  () => queryPublishedCategoryCounts(),
  ['db', 'blog', 'category-counts'],
  cacheOptions,
);
const cachedRelated = unstable_cache(
  (slug: string, category: BlogCategory, limit: number) => queryRelatedPosts(slug, category, limit),
  ['db', 'blog', 'related'],
  cacheOptions,
);
const cachedForJobCategory = unstable_cache(
  (relatedCategorySlug: string, limit: number) => queryPostsForJobCategory(relatedCategorySlug, limit),
  ['db', 'blog', 'for-job-category'],
  cacheOptions,
);

/**
 * No database configured means no blog, not a crashed build.
 *
 * `next build` renders the public tree with DATABASE_URL unset in CI (see
 * .github/workflows/ci.yml, which builds without a database on purpose), and
 * lib/db/index.ts throws the moment it is imported without one. Under Väg A
 * this file read the filesystem and the question never arose; now the blog is
 * a database read on a route that is pre-rendered, so the empty answer has to
 * be a deliberate one. In production the variable is always set — an empty
 * /blog there would mean the database is down, which every other page would be
 * reporting too.
 */
function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getBlogPosts(): Promise<BlogPostMeta[]> {
  if (!hasDatabase()) return [];
  const rows = await cachedOrRaw(() => cachedPosts(), () => queryPublishedPosts());
  return rows.map(toMeta);
}

export async function getBlogSlugs(): Promise<string[]> {
  return (await getBlogPosts()).map((post) => post.slug);
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  if (!hasDatabase()) return null;
  const row = await cachedOrRaw(() => cachedPost(slug), () => queryPublishedPost(slug));
  if (!row) return null;
  const { html, headings } = renderArticle(row.body);
  return { ...toMeta(row), html, headings };
}

export type BlogPostPage = {
  posts: BlogPostMeta[];
  total: number;
  /** At least 1, so "page 1 of an empty list" is a page and not a 404. */
  totalPages: number;
};

/**
 * One page of `/blog`, or of a category archive when `category` is given.
 * The caller 404s a `page` past `totalPages`; this function only answers.
 */
export async function getBlogPostPage(options: {
  category?: BlogCategory;
  page: number;
}): Promise<BlogPostPage> {
  if (!hasDatabase()) return { posts: [], total: 0, totalPages: 1 };
  const category = options.category ?? null;
  const { posts, total } = await cachedOrRaw(
    () => cachedPostPage(category, options.page),
    () =>
      queryPublishedPostPage({
        category: options.category,
        page: options.page,
        pageSize: BLOG_PAGE_SIZE,
      }),
  );
  return {
    posts: posts.map(toMeta),
    total,
    totalPages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)),
  };
}

/**
 * Published post count for every category, zeros included, in the canonical
 * category order. One read feeds the /blog chips, the archive's robots rule
 * and the sitemap, so the three cannot disagree about which archive exists.
 */
export async function getBlogCategoryCounts(): Promise<Array<{ category: BlogCategory; total: number }>> {
  const rows = hasDatabase()
    ? await cachedOrRaw(() => cachedCategoryCounts(), () => queryPublishedCategoryCounts())
    : [];
  const byCategory = new Map(rows.map((row) => [row.category, row.total]));
  return BLOG_CATEGORIES.map((category) => ({ category, total: byCategory.get(category) ?? 0 }));
}

/** "Artículos relacionados": same category first, then the most recent; never itself. */
export async function getRelatedPosts(post: BlogPostMeta, limit = 3): Promise<BlogPostMeta[]> {
  if (!hasDatabase()) return [];
  const rows = await cachedOrRaw(
    () => cachedRelated(post.slug, post.category, limit),
    () => queryRelatedPosts(post.slug, post.category, limit),
  );
  return rows.map(toMeta);
}

/** The newest posts, optionally of one category — homepage and employer pages. */
export async function getLatestBlogPosts(limit: number, category?: BlogCategory): Promise<BlogPostMeta[]> {
  if (limit < 1) return [];
  const { posts } = await getBlogPostPage({ category, page: 1 });
  return posts.slice(0, limit);
}

/**
 * Posts written for one job category — the sector guide first — topped up
 * from `fallback` (newest first) when there are fewer than `limit`. Returns
 * an empty list rather than filler when neither has anything: every caller
 * omits its block entirely in that case.
 */
export async function getPostsForJobCategory(
  jobCategorySlug: string | undefined,
  limit: number,
  fallback?: BlogCategory,
): Promise<BlogPostMeta[]> {
  if (!hasDatabase() || limit < 1) return [];
  const matched =
    jobCategorySlug && SLUG_PATTERN.test(jobCategorySlug)
      ? (
          await cachedOrRaw(
            () => cachedForJobCategory(jobCategorySlug, limit),
            () => queryPostsForJobCategory(jobCategorySlug, limit),
          )
        ).map(toMeta)
      : [];
  if (matched.length >= limit || !fallback) return matched;

  const seen = new Set(matched.map((post) => post.slug));
  const extra = (await getLatestBlogPosts(limit + matched.length, fallback)).filter(
    (post) => !seen.has(post.slug),
  );
  return [...matched, ...extra].slice(0, limit);
}

/**
 * The slug a retired URL should 301 to, or null. Called by the article route
 * only after getBlogPost() has come back empty — a live post always wins over a
 * redirect, so a slug can never be both.
 */
export async function getBlogRedirect(slug: string): Promise<string | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  if (!hasDatabase()) return null;
  return cachedOrRaw(() => cachedRedirect(slug), () => queryRedirectTarget(slug));
}
