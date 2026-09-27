// The C0 article drafts (PLAN-GROWTH.md §4 C0): what a file under
// content/blog-drafts/ must look like to be importable, and the check that
// says so without a database.
//
//   npm run blog:drafts                          # every draft
//   npm run blog:drafts -- content/blog-drafts/x.md
//
// Used three ways: by that command while an article is being written, by
// scripts/verify-blog.ts (so CI rejects a draft the import would reject), and
// by scripts/blog-import.ts --drafts, which refuses to insert anything that
// fails here. One validator, so "passes CI" and "imports" are the same claim.
//
// A draft is validated against the SAME payload schema the admin API uses
// (app/api/admin/blog/schema.ts) — description length, the guias-por-sector
// rule, slug shapes — plus the job taxonomy through lib/data.ts, plus the
// content rules in content/blog/README.md that can be checked mechanically.
// The editorial SEO checklist (lib/blog-editor.ts) is reported but, as in the
// editor, is advice: it never fails a draft.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { BLOG_CATEGORIES, isBlogCategory } from '../lib/blog-categories';
import { SLUG_PATTERN } from '../lib/blog';
import { seoChecklist, type SeoCheck } from '../lib/blog-editor';
import { blogPostSchema, unknownRelatedTaxonomy } from '../app/api/admin/blog/schema';
import { getCategories, getCities } from '../lib/data';

export const BLOG_DIR = join(process.cwd(), 'content', 'blog');
export const DRAFTS_DIR = join(process.cwd(), 'content', 'blog-drafts');

/** The standing line every derechos-laborales article carries (§4 C0). */
export const LEGAL_DISCLAIMER =
  'Esta nota es informativa y no reemplaza el asesoramiento de un profesional.';
/** First line of a derechos-laborales body until a lawyer has read it (§7 D14). */
export const LEGAL_REVIEW_MARKER = 'Revisión pendiente';

export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Frontmatter faltante o mal formado');
  const [, block, body] = match;
  const data: Record<string, string> = {};
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) throw new Error(`Línea de frontmatter inválida: "${line}"`);
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body };
}

// Drafts never carry a date: an article gets its editorial date when the
// owner publishes it (lib/db/blog.ts stamps today), not the day a model wrote
// it. And a draft is a draft — `published: true` in this folder is a mistake.
const draftFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(BLOG_CATEGORIES),
  published: z.literal('false'),
  relatedCategory: z.string().optional(),
  relatedCity: z.string().optional(),
});

export type Draft = {
  file: string;
  slug: string;
  title: string;
  description: string;
  category: (typeof BLOG_CATEGORIES)[number];
  relatedCategory: string | null;
  relatedCity: string | null;
  body: string;
};

export type DraftReport = { file: string; draft: Draft | null; errors: string[]; advice: SeoCheck[] };

export function listDraftFiles(): string[] {
  if (!existsSync(DRAFTS_DIR)) return [];
  return readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((f) => join(DRAFTS_DIR, f));
}

/** Slugs a draft may link to as /blog/{slug}: the imported articles and the other drafts. */
function knownBlogSlugs(): Set<string> {
  const fromDir = (dir: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
          .map((f) => f.replace(/\.md$/, ''))
      : [];
  return new Set([...fromDir(BLOG_DIR), ...fromDir(DRAFTS_DIR)]);
}

/**
 * Whether a site-relative link points at a route that exists. A 404 in the
 * first paragraph is the internal link the brief asks for, broken.
 */
function internalLinkError(
  href: string,
  categories: Set<string>,
  cities: Set<string>,
  blogSlugs: Set<string>,
): string | null {
  const path = href.replace(/[?#].*$/, '').replace(/\/$/, '') || '/';
  const seg = path.split('/').filter(Boolean);
  const ok = (() => {
    if (['/', '/empleos', '/publicar', '/planes', '/contacto', '/blog'].includes(path)) return true;
    if (seg[0] === 'trabajo' && seg.length === 2) return categories.has(seg[1]);
    if (seg[0] === 'trabajo' && seg.length === 3) return categories.has(seg[1]) && cities.has(seg[2]);
    if (seg[0] === 'trabajo-en' && seg.length === 2) return cities.has(seg[1]);
    if (seg[0] === 'blog' && seg[1] === 'categoria' && seg.length === 3) return isBlogCategory(seg[2]);
    if (seg[0] === 'blog' && seg.length === 2) return blogSlugs.has(seg[1]);
    return false;
  })();
  return ok ? null : `enlace interno a una ruta que no existe: ${href}`;
}

/** The content rules (content/blog/README.md) a machine can see in a body. */
export function checkDraftBodyRules(category: string, body: string): string[] {
  const errors: string[] = [];
  if (/<\/?[a-z][^>]*>/i.test(body.replace(/`[^`]*`/g, ''))) {
    errors.push('el cuerpo contiene HTML; se mostraría como texto. Usá Markdown.');
  }
  if (/^#[ \t]/m.test(body)) errors.push('el cuerpo usa "# " (h1); el título ya es el h1, usá "##".');
  if (category === 'derechos-laborales') {
    const firstLine = body.split('\n').find((l) => l.trim()) ?? '';
    if (!firstLine.includes(LEGAL_REVIEW_MARKER)) {
      errors.push(`un artículo de derechos laborales empieza con una línea "${LEGAL_REVIEW_MARKER}"`);
    }
    // The clause, not the exact punctuation around it: "…de un profesional —
    // consultá…" says the same thing as the standing line.
    if (!body.includes(LEGAL_DISCLAIMER.replace(/\.$/, ''))) {
      errors.push(`falta la línea: "${LEGAL_DISCLAIMER}"`);
    }
  }
  return errors;
}

export async function checkDraft(file: string): Promise<DraftReport> {
  const errors: string[] = [];
  const slug = basename(file).replace(/\.md$/, '');
  if (!SLUG_PATTERN.test(slug)) errors.push(`el nombre de archivo no es un slug válido: ${slug}`);

  let parsed: { data: Record<string, string>; body: string };
  try {
    parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  } catch (err) {
    return { file, draft: null, errors: [...errors, (err as Error).message], advice: [] };
  }

  const front = draftFrontmatterSchema.safeParse(parsed.data);
  if (!front.success) {
    for (const issue of front.error.issues) errors.push(`frontmatter.${issue.path.join('.')}: ${issue.message}`);
    return { file, draft: null, errors, advice: [] };
  }
  const meta = front.data;
  const body = parsed.body.trim();
  const draft: Draft = {
    file,
    slug,
    title: meta.title,
    description: meta.description,
    category: meta.category,
    relatedCategory: meta.relatedCategory || null,
    relatedCity: meta.relatedCity || null,
    body,
  };

  // The admin API's own rules, so an import can never store what the editor
  // would have refused.
  const payload = blogPostSchema.safeParse({
    title: draft.title,
    slug,
    description: draft.description,
    body,
    category: draft.category,
    status: 'draft',
    relatedCategory: draft.relatedCategory,
    relatedCity: draft.relatedCity,
  });
  if (!payload.success) {
    for (const issue of payload.error.issues) errors.push(`${issue.path.join('.')}: ${issue.message}`);
  }

  const [categoryRows, cityRows] = await Promise.all([getCategories(), getCities()]);
  const unknown = unknownRelatedTaxonomy(draft, { categories: categoryRows, cities: cityRows });
  if (unknown) errors.push(unknown);

  errors.push(...checkDraftBodyRules(draft.category, body));

  const categories = new Set(categoryRows.map((c) => c.slug));
  const cities = new Set(cityRows.map((c) => c.slug));
  const blogSlugs = knownBlogSlugs();
  for (const [, href] of body.matchAll(/\]\(\s*([^)\s]+)[^)]*\)/g)) {
    if (href.startsWith('/')) {
      const err = internalLinkError(href, categories, cities, blogSlugs);
      if (err) errors.push(err);
    } else if (/^https?:\/\/(www\.)?trabajo\.com\.py/.test(href)) {
      errors.push(`enlace interno absoluto: usá la ruta relativa (${href})`);
    } else if (!href.startsWith('https://')) {
      errors.push(`enlace externo sin https: ${href}`);
    }
  }

  const advice = seoChecklist({
    title: draft.title,
    description: draft.description,
    body,
    category: draft.category,
    relatedCategory: draft.relatedCategory ?? '',
  }).filter((c) => !c.ok);
  const unverified = body.match(/\[VERIFICAR/g)?.length ?? 0;
  if (unverified > 0) {
    advice.push({
      id: 'verificar',
      label: `${unverified} marcador(es) [VERIFICAR] sin resolver`,
      ok: false,
      hint: 'Resolvelos contra la fuente oficial antes de publicar (content/blog-drafts/README.md).',
    });
  }

  return { file, draft, errors, advice };
}

export async function checkDrafts(files = listDraftFiles()): Promise<DraftReport[]> {
  const reports: DraftReport[] = [];
  for (const file of files) reports.push(await checkDraft(file));
  const seen = new Map<string, string>();
  for (const r of reports) {
    if (!r.draft) continue;
    const prev = seen.get(r.draft.title);
    if (prev) r.errors.push(`título repetido con ${prev}`);
    seen.set(r.draft.title, basename(r.file));
  }
  return reports;
}

// CLI
if (process.argv[1] && basename(process.argv[1]).startsWith('blog-drafts')) {
  (async () => {
    const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const reports = await checkDrafts(args.length ? args.map((a) => join(process.cwd(), a)) : undefined);
    let failed = 0;
    for (const r of reports) {
      const name = r.file.replace(process.cwd() + '/', '');
      console.log(`${r.errors.length ? 'FAIL' : 'ok  '}  ${name}`);
      for (const e of r.errors) console.log(`        error:  ${e}`);
      for (const a of r.advice) console.log(`        aviso:  ${a.label} — ${a.hint}`);
      if (r.errors.length) failed += 1;
    }
    console.log(`\n${reports.length} drafts, ${failed} failing.`);
    process.exit(failed ? 1 : 0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
