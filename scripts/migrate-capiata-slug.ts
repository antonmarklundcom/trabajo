// One-off data migration: renames the "capiatá" city slug to "capiata"
// (PLAN-GROWTH.md §4 S1, AGENTS.md — a slug is a live SEO URL and its rename
// needs a 301, shipped alongside this in next.config.ts's redirects()).
//
//   npm run db:migrate-capiata-slug
//
// Why this exists rather than relying on `npm run db:seed`: scripts/
// seed-import.ts upserts cities by slug via onDuplicateKeyUpdate, which
// matches on the unique key BEFORE the write — so pointing it at a JSON file
// whose slug changed from "capiatá" to "capiata" would INSERT a second city
// row rather than renaming the first, leaving every existing job's cityId
// pointing at the old, now-orphaned row. This script renames the row IN
// PLACE first, so the next `db:seed` run correctly matches it and only
// updates `name`/`sortOrder` as usual.
//
// Idempotent: an UPDATE that matches zero rows (already renamed, or a seed
// deploy that never had the accented slug) is a no-op, safe to re-run.
import { requireDatabaseUrl, describeTarget } from './require-db-url';

const OLD_SLUG = 'capiatá';
const NEW_SLUG = 'capiata';

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Renaming city slug on ${describeTarget(url)} ...`);

  // Imported after the guard — lib/db builds its pool at module evaluation.
  const { db } = await import('../lib/db');
  const { cities } = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const [existingOld] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, OLD_SLUG));
  const [existingNew] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, NEW_SLUG));

  if (!existingOld) {
    console.log(`No city with slug "${OLD_SLUG}" found — already renamed, or a fresh seed. Nothing to do.`);
    process.exit(0);
  }
  if (existingNew) {
    console.error(
      `Both "${OLD_SLUG}" (id ${existingOld.id}) and "${NEW_SLUG}" (id ${existingNew.id}) exist. ` +
        'A previous seed-import run likely already inserted the duplicate this script exists to prevent. ' +
        'Resolve by hand: reassign jobs.city_id from the old row to the new one, then delete the old row.',
    );
    process.exit(1);
  }

  await db.update(cities).set({ slug: NEW_SLUG }).where(eq(cities.id, existingOld.id));
  console.log(`Renamed city id ${existingOld.id}: "${OLD_SLUG}" -> "${NEW_SLUG}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
