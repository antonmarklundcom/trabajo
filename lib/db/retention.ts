// The retention sweep's queries — PLAN-PHASE2.md §4.3.
//
// This is the one module in lib/db that is deliberately NOT scoped to a single
// subject, so it does not and cannot follow the "candidateId first" rule that
// lib/db/candidate-*.ts follows. A retention sweep is a whole-table operation
// by definition; pretending otherwise would just hide that fact behind a loop.
//
// What it does instead, to be reviewable:
//   - Every function is either a pure SELECT ("what is due") or a DELETE/UPDATE
//     that takes an explicit list of ids ("do exactly this"). Nothing here both
//     decides and destroys, so scripts/db-purge.ts can print the first half and
//     stop, which is what makes `--dry-run` the default meaningful rather than
//     decorative.
//   - Every cutoff is a parameter. There is no `new Date()` inside a WHERE
//     clause in this file, so what the dry run listed is what the apply run
//     acts on.
//
// Nothing here deletes a candidate: that path is deleteCandidateAccount() in
// lib/db/candidate-arco.ts, because the ordered destruction of §4.4 must have
// exactly one implementation.
import 'server-only';

import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import {
  applications,
  candidates,
  consents,
  dataAccessLogs,
  deletionRequests,
  jobs,
} from './schema';

async function getDb() {
  return (await import('./index')).db;
}

// ---------------------------------------------------------------------------
// 1. Candidate profiles + CVs — 24 months after last login
// ---------------------------------------------------------------------------

export type DueCandidate = {
  id: number;
  lastActivityAt: Date;
  hasLoggedIn: boolean;
};

/**
 * `last_login_at` falls back to `created_at`: an account that was created and
 * never used has no login date, and reading that as "no inactivity yet" would
 * keep exactly the profiles with the least reason to exist forever.
 */
const lastActivity = sql<Date>`COALESCE(${candidates.lastLoginAt}, ${candidates.createdAt})`;

export async function findCandidatesInactiveSince(cutoff: Date): Promise<DueCandidate[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: candidates.id,
      lastActivityAt: lastActivity,
      lastLoginAt: candidates.lastLoginAt,
    })
    .from(candidates)
    .where(lt(lastActivity, cutoff))
    .orderBy(asc(lastActivity));

  return rows.map((row) => ({
    id: row.id,
    lastActivityAt: new Date(row.lastActivityAt),
    hasLoggedIn: row.lastLoginAt !== null,
  }));
}

/**
 * Candidates inside the warning window: past the warning threshold, not yet
 * past the purge threshold. Reported only — there is no email provider in this
 * repo yet (§8 Q5), and a purge that happens without the warning the policy
 * promised is worse than a late purge.
 */
export type DueWarning = DueCandidate & { email: string; name: string };

/**
 * Candidates inside the warning window who have not already been warned about
 * THIS spell of inactivity.
 *
 * The second half is the whole difference between a warning and a nuisance. The
 * window is months wide and the sweep runs on a schedule, so a plain window
 * query re-selects the same people every run. `retention_warned_at` is compared
 * against last activity rather than merely tested for NULL: a candidate who
 * logs back in leaves the window, and if they fall inactive again later, the
 * stored timestamp now predates their return — so they are warned afresh rather
 * than purged in silence on the strength of a warning sent before they last
 * used the site.
 *
 * Returns the address and name because the caller has to send an email, and
 * that is the one row-level read of candidate data this module does. It is
 * covered by AGENTS.md's retention exception, and by nothing wider: the caller
 * is the purge script, never a page.
 */
export async function findCandidatesToWarn(
  warnCutoff: Date,
  purgeCutoff: Date,
): Promise<DueWarning[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: candidates.id,
      email: candidates.email,
      name: candidates.name,
      lastActivityAt: lastActivity,
      lastLoginAt: candidates.lastLoginAt,
      retentionWarnedAt: candidates.retentionWarnedAt,
    })
    .from(candidates)
    .where(
      and(
        lt(lastActivity, warnCutoff),
        sql`${lastActivity} >= ${purgeCutoff}`,
        or(
          isNull(candidates.retentionWarnedAt),
          sql`${candidates.retentionWarnedAt} < ${lastActivity}`,
        ),
      ),
    )
    .orderBy(asc(lastActivity));

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    lastActivityAt: new Date(row.lastActivityAt),
    hasLoggedIn: row.lastLoginAt !== null,
  }));
}

/**
 * Records that the warning went out.
 *
 * Written only after a successful send, so a provider outage means the
 * candidate is warned on the next run instead of being silently skipped until
 * the day they are purged.
 */
export async function markRetentionWarned(candidateId: number, at: Date): Promise<void> {
  const db = await getDb();
  await db
    .update(candidates)
    .set({ retentionWarnedAt: at })
    .where(eq(candidates.id, candidateId));
}

// ---------------------------------------------------------------------------
// 2. Application personal data — 12 months after the job closed
//
// Redaction, not row deletion (§4.3). The husk keeps the employer's history and
// the admin statistics coherent for the same reason it does in §4.4.
// ---------------------------------------------------------------------------

export type DueApplication = {
  id: number;
  jobId: number;
  jobClosedAt: Date;
  createdAt: Date;
};

/**
 * "Closed" is two different columns depending on how the job ended: an archived
 * job closed when it was archived (`updated_at`, the only timestamp we have for
 * it), an expired one closed at `expires_at`. A job can be both, in either
 * order, so the clock starts at the EARLIER of the two — the moment it stopped
 * being a live listing. Taking the later one would extend retention by however
 * long the job sat expired before someone archived it, which is a retention
 * period set by an admin's housekeeping rather than by the policy.
 *
 * A job that is still open has neither date, and its applications are not due
 * however old they are: §4.3 starts the clock at job close, not at application.
 *
 * The predicate and the reported date are the same expression on purpose, so
 * the dry run cannot print one date and act on another.
 */
export async function findApplicationsToRedact(cutoff: Date): Promise<DueApplication[]> {
  const db = await getDb();
  // NULL for a job that was never archived, so LEAST() below ignores it.
  const archivedAt = sql`CASE WHEN ${jobs.status} = 'archived' THEN ${jobs.updatedAt} END`;
  // LEAST() is NULL if ANY argument is NULL, hence the COALESCE fallbacks: with
  // only one of the two dates present, that one is the close date.
  const jobClosedAt = sql<Date>`COALESCE(LEAST(${jobs.expiresAt}, ${archivedAt}), ${jobs.expiresAt}, ${archivedAt})`;

  const rows = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      jobClosedAt,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(isNull(applications.redactedAt), sql`${jobClosedAt} < ${cutoff}`))
    .orderBy(asc(applications.createdAt));

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    jobClosedAt: new Date(row.jobClosedAt),
    createdAt: row.createdAt,
  }));
}

/**
 * NULLs the personal columns of the given applications and stamps
 * `redacted_at`. `candidate_id` is KEPT, unlike §4.4: the candidate still has
 * an account and must keep seeing this application, marked redacted, in their
 * own history — losing the row from "mis postulaciones" would look like we lost
 * the application rather than aged out the employer's copy of their details.
 */
export async function redactApplications(ids: number[], at: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const [result] = await db
    .update(applications)
    .set({ name: null, phone: null, email: null, message: null, cvId: null, redactedAt: at })
    .where(and(inArray(applications.id, ids), isNull(applications.redactedAt)));
  return result.affectedRows;
}

// ---------------------------------------------------------------------------
// 3. consents — 5 years after the data they authorised was purged
//
// The clock starts at the purge, not at the grant: the row's whole job is to
// prove that the deletion was authorised, so it has to outlive it. That makes
// `deletion_requests.executed_at` the only correct anchor, and it is why the
// sweep can never purge the consents of a candidate who still exists.
// ---------------------------------------------------------------------------

export type DueConsent = {
  id: number;
  candidateId: number;
  purgedAt: Date;
};

export async function findConsentsToDelete(cutoff: Date): Promise<DueConsent[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: consents.id,
      candidateId: consents.subjectId,
      purgedAt: deletionRequests.executedAt,
    })
    .from(consents)
    .innerJoin(deletionRequests, eq(deletionRequests.candidateId, consents.subjectId))
    .where(
      and(
        eq(consents.subjectType, 'candidate'),
        isNotNull(deletionRequests.executedAt),
        lt(deletionRequests.executedAt, cutoff),
        // Belt to the suspenders of "the candidate row is gone": deletion_requests
        // deliberately has no FK, so a resurrected id must not drag a live
        // candidate's consent ledger out with it.
        sql`NOT EXISTS (SELECT 1 FROM ${candidates} WHERE ${candidates.id} = ${consents.subjectId})`,
      ),
    )
    .orderBy(asc(consents.id));

  // One candidate can have several executed deletion_requests rows (a retry, or
  // a re-signup that was later deleted again), which would repeat the consent.
  const seen = new Set<number>();
  const unique: DueConsent[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push({ id: row.id, candidateId: row.candidateId, purgedAt: new Date(row.purgedAt!) });
  }
  return unique;
}

export async function deleteConsents(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const [result] = await db.delete(consents).where(inArray(consents.id, ids));
  return result.affectedRows;
}

// ---------------------------------------------------------------------------
// 4. data_access_logs — 24 months
// ---------------------------------------------------------------------------

export type DueAccessLog = {
  id: number;
  action: string;
  createdAt: Date;
};

export async function findAccessLogsToDelete(cutoff: Date): Promise<DueAccessLog[]> {
  const db = await getDb();
  return db
    .select({
      id: dataAccessLogs.id,
      action: dataAccessLogs.action,
      createdAt: dataAccessLogs.createdAt,
    })
    .from(dataAccessLogs)
    .where(lt(dataAccessLogs.createdAt, cutoff))
    .orderBy(asc(dataAccessLogs.createdAt));
}

export async function deleteAccessLogs(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const [result] = await db.delete(dataAccessLogs).where(inArray(dataAccessLogs.id, ids));
  return result.affectedRows;
}
