// One-time import of the Väg A Markdown articles into blog_posts.
//
//   npm run blog:import           # dry run, prints what it would insert
//   npm run blog:import -- --write
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

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
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

async function main() {
  const write = process.argv.includes('--write');
  requireDatabaseUrl();

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
