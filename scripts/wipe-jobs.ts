// One-off: deletes ALL jobs (and any companies left with zero jobs) so
// db:seed can be re-run against a clean slate. Needed because db:seed only
// upserts by slug — it never removes rows that dropped out of
// lib/seed/jobs.json, so replacing the seed file's content and reseeding
// alone would leave the old jobs sitting alongside the new ones.
//
//   DATABASE_URL='mysql://...' npx tsx --env-file-if-exists=.env scripts/wipe-jobs.ts
//
// Categories and cities are untouched. applications.job_id has no DB-level
// foreign key (lib/db/schema.ts), so deleting jobs cannot fail or cascade
// against it — moot today since db:verify shows 0 application rows anyway.
import { requireDatabaseUrl, describeTarget } from './require-db-url';

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Wiping all jobs from ${describeTarget(url)} ...`);

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');

  const before = await db.select({ id: schema.jobs.id }).from(schema.jobs);
  await db.delete(schema.jobs);
  // No jobs reference any company anymore, so every company is now orphaned.
  await db.delete(schema.companies);

  console.log(`Deleted ${before.length} jobs and their companies.`);
  console.log('Run `npm run db:seed` next to load the new seed data.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
