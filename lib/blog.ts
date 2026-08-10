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

// marked is configured with raw HTML passthrough OFF (the default — no
// `html: true`) and NO sanitizer (DOMPurify/jsdom) is layered on top. That's
// deliberate: the content lives in this repo, so whoever can publish an
// article can already publish arbitrary React — a sanitizer would defend
// against an attacker who, by definition, has already won. Turning off raw
// HTML passthrough is hygiene, not security: it stops a pasted code block
// from another site smuggling in a tracking pixel unnoticed.
marked.setOptions({ gfm: true });

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
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const meta = frontmatterSchema.parse(data);
  const html = marked.parse(body, { async: false });
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
  const filename = `${slug}.md`;
  if (!fs.existsSync(path.join(BLOG_DIR, filename))) return null;
  const post = readPostFile(filename);
  if (!post.published) return null;
  return post;
}
