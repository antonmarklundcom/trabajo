// Prints row counts per table plus the counts the Phase A/B gates are stated
// in, so a migration + seed run can be checked at a glance.
//
//   npm run db:verify
//
// Exits 1 if the seed-import gate is violated (28 jobs / 10 categories /
// 7 cities after any number of import runs — re-running must not duplicate).
import './require-db-url';
import { and, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  activityLog,
  applications,
  categories,
  cities,
  companies,
  jobs,
  users,
} from '../lib/db/schema';

const EXPECTED = { jobs: 28, categories: 10, cities: 7 };

type CountableTable = Parameters<ReturnType<typeof db.select>['from']>[0];

async function countOf(table: CountableTable): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table);
  return Number(row.n);
}

async function main() {
  const counts = {
    users: await countOf(users),
    companies: await countOf(companies),
    categories: await countOf(categories),
    cities: await countOf(cities),
    jobs: await countOf(jobs),
    applications: await countOf(applications),
    activity_log: await countOf(activityLog),
  };

  const [{ n: publishedVisible }] = await db
    .select({ n: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'published'),
        or(isNull(jobs.expiresAt), gt(jobs.expiresAt, sql`NOW()`)),
      ),
    );

  const byStatus = await db
    .select({ status: jobs.status, n: count() })
    .from(jobs)
    .groupBy(jobs.status);

  console.log('Row counts');
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(14)} ${n}`);
  }

  console.log('\nJobs by status');
  for (const row of byStatus) {
    console.log(`  ${String(row.status).padEnd(14)} ${row.n}`);
  }
  console.log(`\nPublicly visible (visiblePredicate): ${publishedVisible}`);

  const problems: string[] = [];
  for (const [key, expected] of Object.entries(EXPECTED) as [keyof typeof EXPECTED, number][]) {
    if (counts[key] !== expected) {
      problems.push(`${key}: expected ${expected}, got ${counts[key]}`);
    }
  }

  if (problems.length > 0) {
    console.error('\nSeed gate FAILED:');
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nRe-running scripts/seed-import.ts must not duplicate rows.');
    process.exit(1);
  }

  console.log('\nSeed gate OK: 28 jobs / 10 categories / 7 cities.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
