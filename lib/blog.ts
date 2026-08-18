import 'server-only';
import { unstable_cache } from 'next/cache';
import { marked } from 'marked';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import {
  queryPublishedPost,
  queryPublishedPosts,
  queryRedirectTarget,
  type BlogPostRow,
} from './db/blog';
import { imagePublicUrl } from './image-storage';

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

/**
 * Schemes a link or image may point at.
 *
 * An allowlist, not a blocklist of `javascript:`: the set of things a browser
 * will execute from a URL is not fixed and not enumerable — `data:text/html`,
 * `vbscript:`, and whatever a future engine adds. The set of schemes an article
 * legitimately needs is three, and it does not grow.
 *
 * Relative URLs (`/empleos`, `#seccion`, `imagen.webp`) carry no scheme at all
 * and are always allowed; they cannot execute anything.
 */
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * True when a destination is safe to put in an href or src.
 *
 * The parse is what does the work. Hand-written scheme matching is where these
 * checks go wrong, because a browser ignores things a naive regex does not:
 * leading whitespace and control characters, `JaVaScRiPt:`, and
 * `java\tscript:` are all live in some engine or other. `new URL()` normalises
 * exactly the way the browser will, so the two agree about what the scheme is.
 */
function isAllowedUrl(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;

  // No scheme means relative. A bare `//host/path` is protocol-relative — it
  // inherits https from the page, so it is resolvable and safe to allow.
  let parsed: URL;
  try {
    parsed = new URL(trimmed, 'https://trabajo.com.py');
  } catch {
    // Unparseable is not a URL we should be emitting.
    return false;
  }
  return ALLOWED_URL_SCHEMES.has(parsed.protocol);
}

marked.setOptions({ gfm: true });
marked.use({
  renderer: {
    // EXTENDS the default renderer, never replaces it. Anything not listed here
    // keeps marked's own implementation — which is why the `html` escape below
    // and these two can live in one object without one switching the other off.
    html(token) {
      return escapeHtml(typeof token === 'string' ? token : (token.raw ?? token.text ?? ''));
    },

    /**
     * The gap PLAN-PHASE3-DRAFT.md §12.1 found: the `html` renderer above
     * escapes raw tags, but Markdown's own link syntax never goes through it.
     * `[x](javascript:alert(1))` produced a live anchor, and since 2026-08-12
     * the body arrives over HTTP from an admin session (§11.2) — so this is the
     * boundary AGENTS.md describes between an editor writing an article and an
     * editor writing JavaScript that runs in every visitor's browser.
     *
     * A rejected destination keeps its text and loses its link. Dropping the
     * text would make an attack look like a rendering bug to the editor who
     * pasted it; leaving the words visible shows them what happened.
     */
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!isAllowedUrl(href)) return text;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href.trim())}"${titleAttr}>${text}</a>`;
    },

    /**
     * The same for images. `![x](javascript:…)` is less directly useful to an
     * attacker than an anchor, but `src` is a URL context like any other and
     * the allowlist costs nothing to apply twice.
     */
    image({ href, title, text }) {
      if (!isAllowedUrl(href)) return escapeHtml(text);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href.trim())}" alt="${escapeHtml(text)}"${titleAttr}>`;
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
  return marked.parse(body, { async: false });
}

export const BLOG_CATEGORIES = ['noticias', 'analisis-laboral', 'consejos-cv'] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  noticias: 'Noticias',
  'analisis-laboral': 'Análisis laboral',
  'consejos-cv': 'Consejos de CV',
};

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

export type BlogPost = BlogPostMeta & { html: string };

/** `/img/blog/{uuid}.webp`. One function, so a storage move is one edit. */
export function blogCoverUrl(coverImageKey: string): string {
  return imagePublicUrl(coverImageKey);
}

function toMeta(row: BlogPostRow): BlogPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    publishedAt: row.publishedAt ?? '',
    updatedAt: row.updatedAt.toISOString(),
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

/**
 * `unstable_cache` needs Next's incrementalCache, which does not exist under a
 * plain tsx script (scripts/verify-blog.ts). Falling back to the raw query is
 * safe for the same reason it is in lib/db/queries.ts: the wrapper memoizes a
 * result, it never changes one.
 */
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
  return { ...toMeta(row), html: renderMarkdown(row.body) };
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
