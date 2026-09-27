// The unscoped half of "¿Tu aviso sigue abierto?" (lib/listing-confirm.ts).
//
// Two callers need to look a job up by id alone, before any company scope
// exists: the sending script (which is choosing whom to email) and the redeem
// route (whose only credential is a signed token naming a job id). Neither
// belongs in lib/db/employer.ts, whose every function starts from a companyId
// the caller already holds. So the lookup is here, it is read-only, and the
// WRITES stay in lib/db/employer.ts: the redeem route reads the job's
// companyId from findListingConfirmTarget() and passes it to
// renewEmployerListingFromEmail() / closeEmployerListingFromEmail(), whose
// UPDATEs are scoped on it like every other write in that file.
//
// The one write in this module is bookkeeping, not a job change: the
// activity_log row that makes sending idempotent.
import 'server-only';

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { activityLog, companies, jobs } from './schema';
import { EXPIRY_WARNING_DAYS } from '../listing-expiry';
import { LISTING_CONFIRM_LOG } from '../listing-confirm';

async function getDb() {
  return (await import('./index')).db;
}

export type ListingConfirmCandidate = {
  id: number;
  title: string;
  companyId: number;
  companyName: string;
  expiresAt: Date;
};

/**
 * Published listings whose `expires_at` falls within the next
 * EXPIRY_WARNING_DAYS and has not passed — the same window as /admin's "Avisos
 * que vencen", minus the lapsed tail: a listing that already closed is the
 * renewal conversation's job, not a "sigue abierto" question. Compared against
 * the database's NOW(), like every other expiry predicate in this app.
 */
export async function findListingsDueForConfirmation(): Promise<ListingConfirmCandidate[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyId: jobs.companyId,
      companyName: companies.name,
      expiresAt: jobs.expiresAt,
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(
      and(
        eq(jobs.status, 'published'),
        sql`${jobs.expiresAt} IS NOT NULL`,
        sql`${jobs.expiresAt} > NOW()`,
        sql`${jobs.expiresAt} <= NOW() + INTERVAL ${EXPIRY_WARNING_DAYS} DAY`,
      ),
    )
    .orderBy(asc(jobs.expiresAt));
  return rows.filter((r): r is ListingConfirmCandidate => r.expiresAt !== null);
}

/**
 * For each job id, the `expires_at` values a confirmation email was already
 * sent for (ISO strings, from the activity_log meta). A job is re-asked only
 * once its expiry has moved — i.e. after it was renewed, by any path.
 */
export async function listConfirmationsSent(jobIds: number[]): Promise<Map<number, Set<string>>> {
  const sent = new Map<number, Set<string>>();
  if (jobIds.length === 0) return sent;
  const db = await getDb();
  const rows = await db
    .select({ entityId: activityLog.entityId, meta: activityLog.meta })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, 'job'),
        eq(activityLog.action, LISTING_CONFIRM_LOG.sent),
        inArray(activityLog.entityId, jobIds),
      ),
    );
  for (const row of rows) {
    const meta = (typeof row.meta === 'string' ? safeJson(row.meta) : row.meta) as { expiresAt?: unknown } | null;
    if (!meta || typeof meta.expiresAt !== 'string') continue;
    const set = sent.get(row.entityId) ?? new Set<string>();
    set.add(meta.expiresAt);
    sent.set(row.entityId, set);
  }
  return sent;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Written after at least one recipient's send succeeded, so a provider outage
 * means the job is asked on the next run rather than marked asked and never
 * reached — the same ordering db:purge uses for its retention warning.
 * No actor: the sender is a script, and naming a staff member would be a lie.
 */
export async function recordConfirmationSent(
  jobId: number,
  expiresAt: Date,
  recipients: number,
): Promise<void> {
  const db = await getDb();
  await db.insert(activityLog).values({
    actorUserId: null,
    entityType: 'job',
    entityId: jobId,
    action: LISTING_CONFIRM_LOG.sent,
    meta: { expiresAt: expiresAt.toISOString(), recipients },
    createdAt: new Date(),
  });
}

/**
 * What the redeem route needs to scope its write: whose job this is, and the
 * state the token will be compared against. Public fields only.
 */
export async function findListingConfirmTarget(jobId: number): Promise<{
  id: number;
  companyId: number;
  title: string;
  status: (typeof jobs.$inferSelect)['status'];
  expiresAt: Date | null;
} | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      id: jobs.id,
      companyId: jobs.companyId,
      title: jobs.title,
      status: jobs.status,
      expiresAt: jobs.expiresAt,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  return row ?? null;
}
