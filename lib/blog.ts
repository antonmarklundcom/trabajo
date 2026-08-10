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
// always claimed and did not have. And PLAN-PHASE3-DRAFT.md §5 keeps the door
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
