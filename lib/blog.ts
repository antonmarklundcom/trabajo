import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { marked } from 'marked';

// The only module that touches node:fs for blog content (AGENTS.md: lib/data.ts
// is the sole entry point for the public job catalog seam; per-account and
// per-content data that has no seed representation goes straight to its own
// scoped read path — this is that path for the blog, kept isolated the same
// way so nothing else reaches into content/blog/).

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/**
 * The only shape a blog slug may have. Same idea as STORAGE_KEY_PATTERN in
 * lib/storage.ts: the slug becomes a filesystem path, so the safe set is
 * declared once and asserted, rather than being an assumption about what the
 * router hands over. `[slug]` is one path segment today, but that is a property
 * of the route tree — and this function is a filesystem read that must not
 * depend on a caller elsewhere staying correct.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Cover images are COMMITTED files, not uploads (PLAN-PHASE3.md §9.2).
 *
 * They deliberately do not go through lib/image-storage.ts, and that is not an
 * oversight: that pipeline defends against a stranger putting bytes on our
 * origin at runtime, and there is no stranger here — a cover image arrives in a
 * pull request from whoever can already deploy arbitrary code. Routing it
 * through storeImage() would add no guarantee the commit does not already give,
 * and would move the file out of git into IMAGE_STORAGE_DIR, where a static
 * site would then depend on runtime storage to render its own content.
 *
 * What the pipeline WOULD have enforced still gets enforced — size, dimensions
 * and a single format — but in CI, by scripts/verify-blog.ts, for different
 * reasons: an oversized JPEG committed once lives in git history forever, and
 * an unconverted hero image is an LCP regression on Paraguayan mobile networks.
 */
const COVERS_DIR = path.join(process.cwd(), 'public', 'blog-covers');

/**
 * A bare filename, never a path. Same discipline and same reason as
 * SLUG_PATTERN: the value becomes a filesystem path, so the permitted set is
 * declared once and asserted rather than assumed. No slashes, no `..`, no
 * uppercase, no other extension.
 */
const COVER_IMAGE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

/**
 * Exact, not a maximum (PLAN-PHASE3.md §10.4). Because every cover is the same
 * size, the page writes these as constants and never reads a file header at
 * render time — which is what keeps the largest image on the page from being a
 * layout shift. scripts/verify-blog.ts asserts the files actually match.
 */
export const BLOG_COVER_WIDTH = 1600;
export const BLOG_COVER_HEIGHT = 900;

/**
 * Where the browser fetches a cover. A function rather than a string
 * concatenated at three call sites, for the same reason imagePublicUrl() exists
 * in PLAN-IMAGES.md §2.1: if these bytes ever move, one file changes. Pages
 * call this and do not know the directory.
 */
export function blogCoverUrl(coverImage: string): string {
  return `/blog-covers/${coverImage}`;
}

// Raw HTML in an article is ESCAPED, not passed through and not dropped.
//
// This needs stating precisely, because the obvious assumption is wrong:
// `marked` passes raw HTML through verbatim by default and has had no
// `sanitize` option since v5. Without the renderer override below, a `<script>`
// in a .md file reaches post.html and then dangerouslySetInnerHTML — verified,
// not assumed (scripts/verify-blog.ts asserts it on every push).
//
// Today that is not an exploit: content is committed to this repo, so whoever
// can publish an article can already publish arbitrary React, and a sanitizer
// would be defending against an attacker who has by definition already won.
// The reason to escape anyway is twofold. It stops a code block pasted from
// another site smuggling in a tracking pixel unnoticed — the hygiene this file
// always claimed and did not have. And PLAN-PHASE3.md §5 keeps the door
// open to Väg B, where article bodies live in the database and a non-owner can
// write them; that change must not silently inherit an HTML passthrough nobody
// realised was on.
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

marked.setOptions({ gfm: true });
marked.use({
  renderer: {
    html(token) {
      return escapeHtml(typeof token === 'string' ? token : (token.raw ?? token.text ?? ''));
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

const CATEGORIES = ['noticias', 'analisis-laboral', 'consejos-cv'] as const;

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(160),
  category: z.enum(CATEGORIES),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'publishedAt debe ser YYYY-MM-DD'),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'updatedAt debe ser YYYY-MM-DD'),
  published: z.enum(['true', 'false']).transform((v) => v === 'true'),
  relatedCategory: z.string().optional(),
  relatedCity: z.string().optional(),
  coverImage: z.string().regex(COVER_IMAGE_PATTERN, 'coverImage debe ser un nombre de archivo .webp en minúsculas, sin carpetas').optional(),
  coverAlt: z.string().min(1).max(160).optional(),
}).superRefine((data, ctx) => {
  // Bound at schema level rather than in an `if` inside the page: a cover image
  // without alt text is an accessibility defect that should stop the build, in
  // the same spirit as PR #46's fix to the job gallery's alt text. A page-level
  // check would only fire for articles someone happened to open.
  if (data.coverImage && !data.coverAlt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverAlt'],
      message: 'coverAlt es obligatorio cuando hay coverImage.',
    });
  }
});

export type BlogCategory = (typeof CATEGORIES)[number];

export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  publishedAt: string;
  updatedAt: string;
  published: boolean;
  relatedCategory?: string;
  relatedCity?: string;
  coverImage?: string;
  coverAlt?: string;
};

export type BlogPost = BlogPostMeta & { html: string };

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Frontmatter faltante o mal formado (se espera bloque --- ... ---)');
  }
  const [, block, body] = match;
  const data: Record<string, string> = {};
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) {
      throw new Error(`Línea de frontmatter inválida: "${line}"`);
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return { data, body };
}

function readPostFile(filename: string): BlogPost {
  const slug = filename.replace(/\.md$/, '');
  // Loud rather than skipped: the filename IS the live SEO URL (AGENTS.md), so
  // a file that cannot produce a valid one is a mistake to fix before it ships,
  // not an article to quietly leave out of the list and the sitemap.
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Nombre de archivo inválido en content/blog/: "${filename}". ` +
        'El slug debe ser minúsculas, números y guiones (a-z0-9-).',
    );
  }
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const meta = frontmatterSchema.parse(data);
  // Loud, not silently coverless. A frontmatter field pointing at a file that
  // is not there is a mistake to fix before it ships — rendering the article
  // without its cover would hide the typo behind a page that looks fine, which
  // is the same reasoning readPostFile() already applies to an invalid filename.
  if (meta.coverImage && !fs.existsSync(path.join(COVERS_DIR, meta.coverImage))) {
    throw new Error(
      `El art\u00edculo "${slug}" declara coverImage: ${meta.coverImage}, ` +
        'pero public/blog-covers/ no contiene ese archivo.',
    );
  }
  const html = renderMarkdown(body);
  return { slug, ...meta, html };
}

function readAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map(readPostFile);
}

function toMeta(post: BlogPost): BlogPostMeta {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    category: post.category,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    published: post.published,
    relatedCategory: post.relatedCategory,
    relatedCity: post.relatedCity,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
  };
}

export async function getBlogPosts(): Promise<BlogPostMeta[]> {
  return readAllPosts()
    .filter((p) => p.published)
    .map(toMeta)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export async function getBlogSlugs(): Promise<string[]> {
  return readAllPosts()
    .filter((p) => p.published)
    .map((p) => p.slug);
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  // Before any path is built. `../../AGENTS` is a slug the router will happily
  // hand over for an unknown URL (generateStaticParams covers the known ones;
  // dynamicParams still renders the rest on demand), and path.join() would
  // resolve it straight out of content/blog/. The `.md` suffix bounds the
  // damage to markdown files, which is a bound, not a defence.
  if (!SLUG_PATTERN.test(slug)) return null;

  const filename = `${slug}.md`;
  if (!fs.existsSync(path.join(BLOG_DIR, filename))) return null;
  const post = readPostFile(filename);
  if (!post.published) return null;
  return post;
}

/**
 * Every cover reference declared in content/blog/, INCLUDING articles with
 * `published: false`.
 *
 * Deliberately narrow. scripts/verify-blog.ts needs to see unpublished
 * articles — a draft's cover is a real reference, and treating it as an orphan
 * would delete the image out from under the article before it ships. But an
 * unfiltered "all posts" export would be a loaded gun pointed at the listing
 * page, where it would publish drafts. This returns cover references and
 * nothing else: no body, no title, nothing a page could render.
 */
export function listCoverImageReferences(): { slug: string; coverImage: string; coverAlt: string }[] {
  return readAllPosts()
    .filter((p) => p.coverImage)
    .map((p) => ({ slug: p.slug, coverImage: p.coverImage!, coverAlt: p.coverAlt ?? '' }));
}

/**
 * The cover files actually on disk, for the orphan check in
 * scripts/verify-blog.ts. Missing directory is a valid state and returns []:
 * git does not track empty directories, so public/blog-covers/ legitimately
 * does not exist until the first article gets a cover — the same stance
 * readAllPosts() takes towards a missing content/blog/.
 */
export function listCoverFiles(): string[] {
  if (!fs.existsSync(COVERS_DIR)) return [];
  return fs.readdirSync(COVERS_DIR).filter((f) => !f.startsWith('.'));
}

/** Absolute path of a cover file. Only scripts/verify-blog.ts needs this — it
 *  is the one caller that reads the bytes rather than linking to them, and
 *  keeping the join here is what stops a second module learning the directory. */
export function coverFilePath(coverImage: string): string {
  if (!COVER_IMAGE_PATTERN.test(coverImage)) {
    throw new Error(`Nombre de archivo de portada inválido: "${coverImage}"`);
  }
  return path.join(COVERS_DIR, coverImage);
}
