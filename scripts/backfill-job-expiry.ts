// One-off: gives every published listing that has NO expiry one, now that
// approvals set it (lib/listing-expiry.ts). Before this, nothing ever wrote
// `jobs.expires_at`, so every listing published before this change would
// otherwise stay up forever.
//
//   npm run db:backfill-expiry                      # dry run: counts only
//   npm run db:backfill-expiry -- --write           # grace: NOW() + 30 days
//   npm run db:backfill-expiry -- --write --from-published
//                                                   # published_at + 30 days
//
// Two modes because the owner's decision is not the script's to make:
//
//   - default ("grace"): every such listing gets a full 30 days from today.
//     Nothing disappears on deploy; the renewal queue on /admin fills up in a
//     month.
//   - --from-published: each listing expires 30 days after it was published,
//     never earlier than a Destacado it carries. Anything published more than
//     30 days ago closes IMMEDIATELY and turns into a tombstone (HTTP 200,
//     noindex, similar jobs). That is the honest state for stale listings —
//     and it removes them from the site at once.
//
// Dry run by default, and it prints which listings each mode would close, so
// nobody runs the destructive mode blind. Idempotent: only rows with a NULL
// expiry are touched, so a second run finds nothing.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import { computeListingExpiry, LISTING_DAYS } from '../lib/listing-expiry';

async function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has('--write');
  const fromPublished = args.has('--from-published');

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);
  console.log(`Mode: ${fromPublished ? 'from-published' : 'grace (now + ' + LISTING_DAYS + ' days)'}${write ? '' : ' — DRY RUN'}`);

  const { db } = await import('../lib/db');
  const { jobs } = await import('../lib/db/schema');
  const { and, eq, isNull } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: jobs.id,
      slug: jobs.slug,
      publishedAt: jobs.publishedAt,
      createdAt: jobs.createdAt,
      featuredUntil: jobs.featuredUntil,
    })
    .from(jobs)
    .where(and(eq(jobs.status, 'published'), isNull(jobs.expiresAt)));

  const now = new Date();
  let closing = 0;
  const plan = rows.map((row) => {
    const start = fromPublished ? (row.publishedAt ?? row.createdAt) : now;
    const expiresAt = computeListingExpiry(start, row.featuredUntil);
    if (expiresAt.getTime() <= now.getTime()) closing += 1;
    return { ...row, expiresAt };
  });

  console.log(`Published listings without an expiry: ${plan.length}`);
  console.log(`Of those, closed immediately by this mode: ${closing}`);
  for (const row of plan) {
    const closes = row.expiresAt.getTime() <= now.getTime();
    console.log(
      `  ${closes ? 'CLOSES NOW' : 'expires   '} ${row.expiresAt.toISOString().slice(0, 10)}  /empleos/${row.slug}`,
    );
  }

  if (!write) {
    console.log('\nDry run — nothing written. Add --write to apply.');
    process.exit(0);
  }

  for (const row of plan) {
    await db
      .update(jobs)
      .set({ expiresAt: row.expiresAt })
      .where(and(eq(jobs.id, row.id), isNull(jobs.expiresAt)));
  }
  console.log(`\nWrote an expiry on ${plan.length} listing(s).`);
  console.log('The public cache refreshes within its 5-minute window, or on the next admin save.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
