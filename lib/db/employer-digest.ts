// The one cross-company read behind the weekly summary (scripts/
// employer-digest.ts): which companies to consider at all.
//
// It cannot live in lib/db/employer.ts, whose one rule is that every function
// takes a companyId and every query is scoped by it — "list the companies" has
// no companyId to take. So it lives here, next door, in the same shape as
// lib/db/retention.ts is for the purge: an operational enumerator used by one
// script, never imported by a page or a route.
//
// What keeps it harmless is how little it returns: the company id, its public
// name (for the dry-run printout) and the two digest columns. No listing, no
// count, no user. Everything the summary actually SAYS about a company is read
// afterwards through lib/db/employer.ts, one companyId at a time.
import 'server-only';

import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { companies, users } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type DigestCompany = {
  id: number;
  name: string;
  notifyWeeklyDigest: boolean;
  lastDigestSentAt: Date | null;
};

/**
 * Every company with at least one active employer user — the only companies a
 * summary could be addressed to. A company created from the /publicar form or
 * by the team for a WhatsApp customer has no account behind it, so listing it
 * would only produce a "no_recipients" line per company per week.
 *
 * Opted-out and recently-summarised companies are deliberately NOT filtered
 * here: the script prints why each one is skipped (digestSkipReason() in
 * lib/employer-digest.ts), and a dry run that silently omitted them would not
 * show the operator that the opt-out works.
 */
export async function listDigestCompanies(): Promise<DigestCompany[]> {
  const db = await getDb();
  return db
    .select({
      id: companies.id,
      name: companies.name,
      notifyWeeklyDigest: companies.notifyWeeklyDigest,
      lastDigestSentAt: companies.lastDigestSentAt,
    })
    .from(companies)
    .where(
      exists(
        db
          .select({ one: sql`1` })
          .from(users)
          .where(
            and(
              eq(users.companyId, companies.id),
              eq(users.role, 'employer'),
              eq(users.isActive, true),
            ),
          ),
      ),
    )
    .orderBy(asc(companies.id));
}
