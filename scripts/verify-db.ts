// Prints one row count per table, so a migrate/seed run can be checked at a
// glance and the seed importer's idempotency gate ("run it twice, still 28
// jobs") is verifiable without opening a MySQL client.
//
// Read-only: it never writes. Safe to run against production.
import { count, sql } from 'drizzle-orm';
import { requireDatabaseUrl, describeTarget } from './require-db-url';

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}\n`);

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');

  // Declared order mirrors ARCHITECTURE.md §4 rather than being alphabetical,
  // so the output reads top-down as the dependency chain.
  const tables = [
    ['users', schema.users],
    ['companies', schema.companies],
    ['categories', schema.categories],
    ['cities', schema.cities],
    ['jobs', schema.jobs],
    ['applications', schema.applications],
    ['activity_log', schema.activityLog],
  ] as const;

  const width = Math.max(...tables.map(([name]) => name.length));
  let total = 0;

  for (const [name, table] of tables) {
    const [row] = await db.select({ n: count() }).from(table);
    total += row.n;
    console.log(`${name.padEnd(width)}  ${String(row.n).padStart(6)}`);
  }

  console.log(`${'-'.repeat(width + 8)}`);
  console.log(`${'total'.padEnd(width)}  ${String(total).padStart(6)}`);

  // Job status breakdown: the public site only ever serves `published`, so a
  // surprise here is the earliest signal that the visibility predicate is
  // about to leak or hide rows.
  const byStatus = await db
    .select({ status: schema.jobs.status, n: count() })
    .from(schema.jobs)
    .groupBy(schema.jobs.status)
    .orderBy(sql`count(*) desc`);

  if (byStatus.length > 0) {
    console.log('\njobs by status:');
    for (const row of byStatus) {
      console.log(`  ${row.status.padEnd(width)}  ${String(row.n).padStart(6)}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
