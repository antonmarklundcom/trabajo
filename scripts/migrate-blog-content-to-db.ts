// One-off migration: content/blog/*.md → blog_posts.
//
// The blog moved from Väg A (Markdown files committed to the repo, see
// lib/blog.ts's history) to Väg B (this table, an admin CRUD) on 2026-08-12,
// because the owner wants to publish from the panel, not through Git
// (PLAN-PHASE3-DRAFT.md §5.1 listed this as conditional; that's the decision
// that activated it). This script carries the three articles that already
// existed under Väg A into the database — REAL content, run once. It is not
// part of the app's runtime and lib/blog.ts no longer reads content/blog/ at
// all after this has been run.
//
// Usage: npm run blog:migrate (see package.json)
//
// Idempotent on slug: an article whose slug already exists in blog_posts is
// skipped, not duplicated, so running this twice is safe.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { requireDatabaseUrl, describeTarget } from './require-db-url';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(160),
  category: z.enum(['noticias', 'analisis-laboral', 'consejos-cv']),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  published: z.enum(['true', 'false']).transform((v) => v === 'true'),
  relatedCategory: z.string().optional(),
  relatedCity: z.string().optional(),
});

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Frontmatter faltante o mal formado.');
  const [, block, body] = match;
  const data: Record<string, string> = {};
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) throw new Error(`Línea de frontmatter inválida: "${line}"`);
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body: body.trim() };
}

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}\n`);

  const { blogSlugExists } = await import('../lib/db/blog');
  const { db } = await import('../lib/db');
  const { blogPosts } = await import('../lib/db/schema');

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

  // The system user id staff articles are attributed to — there is no
  // "migration" actor in `users`, so this uses the lowest-numbered active
  // admin/editor account as the closest honest answer. Passed via env
  // because guessing an id in code would be worse than requiring it.
  const actorIdEnv = process.env.BLOG_MIGRATE_USER_ID;
  if (!actorIdEnv || !Number.isInteger(Number(actorIdEnv))) {
    console.error(
      'BLOG_MIGRATE_USER_ID is required — the id of the users row these migrated ' +
        'articles are attributed to (createdBy/updatedBy). Look one up with npm run db:verify ' +
        'or your users table, then: BLOG_MIGRATE_USER_ID=1 npm run blog:migrate',
    );
    process.exit(1);
  }
  const actorId = Number(actorIdEnv);

  let migrated = 0;
  let skipped = 0;

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, '');
    if (!SLUG_PATTERN.test(slug)) {
      console.error(`FAIL  ${filename}: slug inválido, no migrado.`);
      process.exitCode = 1;
      continue;
    }

    if (await blogSlugExists(slug)) {
      console.log(`skip  ${slug} (ya existe en blog_posts)`);
      skipped += 1;
      continue;
    }

    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const meta = frontmatterSchema.parse(data);

    // Inserted directly (not through createBlogPost()) because the frontmatter
    // carries real historical publishedAt/updatedAt dates that createBlogPost's
    // normal "now" stamping would overwrite — this is the one caller allowed
    // to backdate them, and only because it is migrating pre-existing content.
    const publishedAt = meta.published ? new Date(`${meta.publishedAt}T00:00:00Z`) : null;
    const updatedAt = new Date(`${meta.updatedAt}T00:00:00Z`);

    await db.insert(blogPosts).values({
      slug,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      body,
      coverImageKey: null,
      coverAlt: null,
      coverWidth: null,
      coverHeight: null,
      status: meta.published ? 'published' : 'draft',
      relatedCategory: meta.relatedCategory ?? null,
      relatedCity: meta.relatedCity ?? null,
      publishedAt,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: publishedAt ?? updatedAt,
      updatedAt,
    });

    console.log(`ok    ${slug} (${meta.published ? 'published' : 'draft'})`);
    migrated += 1;
  }

  console.log(`\n${migrated} migrated, ${skipped} skipped.`);
  console.log(
    'content/blog/*.md is no longer read by the app — safe to remove once this run is confirmed ' +
      'against the live site.',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
