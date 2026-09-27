// Imports Markdown articles into blog_posts.
//
//   npm run blog:import                       # dry run, prints what it would insert
//   npm run blog:import -- --write
//   npm run blog:import -- --drafts           # content/blog/drafts/ (C0), dry run
//   npm run blog:import -- --drafts --write
//
// --drafts (PLAN-GROWTH.md §4 C0): the content-sprint drafts, validated by
// scripts/blog-drafts.ts — the same check blog:verify runs in CI — and
// inserted as `draft` with no editorial date, so the owner reviews each one in
// /admin/blog and the date is the day they publish it. A single failing draft
// stops the whole run before anything is written.
//
// Written for the Väg A → Väg B cutover (PLAN-PHASE3-DRAFT.md §11). The three
// published articles and the example draft were committed as content/blog/*.md
// and are already indexed under their current slugs; importing them with the
// SAME slug is what makes the migration invisible from outside — no redirects,
// no re-indexing, nothing for a reader to notice.
//
// Idempotent by slug: an article that already exists in the table is skipped,
// never updated. After the cutover the database is the source of truth, and an
// import that overwrote a row would silently revert edits made in /admin since.
//
// The .md files stay in the repo afterwards as the historical record of what
// was imported (content/blog/README.md explains that they are no longer read).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { requireDatabaseUrl } from './require-db-url';
import { checkDrafts, listDraftFiles, parseFrontmatter } from './blog-drafts';

const BLOG_DIR = join(process.cwd(), 'content', 'blog');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The Väg A frontmatter contract, reproduced here rather than imported: it no
// longer exists anywhere else, and this script is the last thing that will ever
// need to understand it.
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

async function importDrafts(write: boolean) {
  const reports = await checkDrafts(listDraftFiles());
  const failing = reports.filter((r) => r.errors.length > 0 || !r.draft);
  if (failing.length > 0) {
    for (const r of failing) console.error(`FAIL  ${r.file}\n        ${r.errors.join('\n        ')}`);
    throw new Error(`${failing.length} draft(s) fail npm run blog:drafts — nothing was imported.`);
  }

  const { db } = await import('../lib/db/index');
  const { blogPosts } = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  let skipped = 0;
  for (const { draft } of reports) {
    if (!draft) continue;
    const [existing] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, draft.slug))
      .limit(1);
    if (existing) {
      console.log(`skip    ${draft.slug} (already in blog_posts, id ${existing.id})`);
      skipped += 1;
      continue;
    }
    console.log(`${write ? 'insert ' : 'would  '} ${draft.slug} — ${draft.title} [${draft.category}, draft]`);
    if (write) {
      await db.insert(blogPosts).values({
        slug: draft.slug,
        title: draft.title,
        description: draft.description,
        body: draft.body,
        category: draft.category,
        status: 'draft',
        relatedCategorySlug: draft.relatedCategory,
        relatedCitySlug: draft.relatedCity,
        publishedAt: null,
        authorUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      inserted += 1;
    }
  }
  console.log(
    write
      ? `\n${inserted} inserted as drafts, ${skipped} skipped.`
      : `\nDry run. ${reports.length - skipped} would be inserted as drafts, ${skipped} skipped. Re-run with --write.`,
  );
}

async function main() {
  const write = process.argv.includes('--write');
  requireDatabaseUrl();

  if (process.argv.includes('--drafts')) {
    await importDrafts(write);
    process.exit(0);
  }

  if (!existsSync(BLOG_DIR)) {
    console.log('content/blog/ does not exist — nothing to import.');
    return;
  }

  const { db } = await import('../lib/db/index');
  const { blogPosts } = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const files = readdirSync(BLOG_DIR).filter(
    (f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md',
  );

  let inserted = 0;
  let skipped = 0;

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, '');
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`Invalid filename in content/blog/: ${filename}`);
    }

    const { data, body } = parseFrontmatter(readFileSync(join(BLOG_DIR, filename), 'utf8'));
    const meta = frontmatterSchema.parse(data);

    const [existing] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    if (existing) {
      console.log(`skip    ${slug} (already in blog_posts, id ${existing.id})`);
      skipped += 1;
      continue;
    }

    console.log(
      `${write ? 'insert ' : 'would  '} ${slug} — ${meta.title} [${meta.category}, ${
        meta.published ? 'published' : 'draft'
      }]`,
    );

    if (write) {
      await db.insert(blogPosts).values({
        slug,
        title: meta.title,
        description: meta.description,
        body: body.trim(),
        category: meta.category,
        // `published: false` in frontmatter meant "no route, not in the list".
        // `draft` is the same statement in the new model.
        status: meta.published ? 'published' : 'draft',
        relatedCategorySlug: meta.relatedCategory ?? null,
        relatedCitySlug: meta.relatedCity ?? null,
        publishedAt: meta.publishedAt,
        // No author: these predate accounts having written anything. Left null
        // rather than attributed to whoever happens to run the import.
        authorUserId: null,
        createdAt: new Date(`${meta.publishedAt}T00:00:00Z`),
        updatedAt: new Date(`${meta.updatedAt}T00:00:00Z`),
      });
      inserted += 1;
    }
  }

  console.log(
    write
      ? `\n${inserted} inserted, ${skipped} skipped.`
      : `\nDry run. ${files.length - skipped} would be inserted, ${skipped} skipped. Re-run with --write.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
