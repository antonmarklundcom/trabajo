// What the next `npm run db:purge` would touch, as counts and dates — the
// read-only half of PLAN-PHASE2.md §4.3, for /admin/retencion.
//
// It exists so the owner can see the sweep's backlog without SSH-ing into
// Hostinger to run the dry run (DEPLOY.md). It reuses the sweep's own query
// functions and the sweep's own cutoff arithmetic, so the page cannot drift
// from the script: if the two ever disagree, the numbers here are wrong in the
// same direction the purge is.
//
// It lives beside lib/db/retention.ts rather than inside it because that module
// is imported by scripts/db-purge.ts, a plain node script — pulling
// `next/cache` into it would drag the framework into the sweep.
//
// NOTHING HERE RETURNS PERSONAL DATA, and that is what keeps this page outside
// the reason-gated, logged path in lib/db/candidates-admin.ts (AGENTS.md): the
// underlying queries return ids and dates only, and everything below reduces
// them to counts and one date per category. There is no candidate id in the
// return type on purpose — a due-for-purge list keyed by id is a list of the
// least active candidates, which is a directory with extra steps.
import 'server-only';

import { unstable_cache } from 'next/cache';

import {
  ACCESS_LOG_RETENTION_MONTHS,
  APPLICATION_REDACTION_MONTHS,
  CANDIDATE_INACTIVITY_MONTHS,
  CANDIDATE_WARNING_MONTHS,
  CONSENT_RETENTION_MONTHS,
  monthsAgo,
} from '../retention';
import {
  findAccessLogsToDelete,
  findApplicationsToRedact,
  findCandidatesToWarn,
  findCandidatesInactiveSince,
  findConsentsToDelete,
} from './retention';

// Same window as lib/db/stats.ts. These are full scans of candidates,
// applications and data_access_logs against an 8-connection pool, and a purge
// backlog that is up to 5 minutes stale is still the same backlog: the sweep
// itself is manual and monthly.
const RETENTION_TTL_SECONDS = 300;

/** One row of the panel: how many, and how far back the oldest one goes. */
export type RetentionBucket = {
  count: number;
  /** Oldest affected date, or null when the bucket is empty. */
  oldest: Date | null;
  /** The cutoff the count was computed against. */
  cutoff: Date;
  /** Retention period in months, read from lib/retention.ts. */
  months: number;
};

export type RetentionSummary = {
  /** When the underlying queries ran — the panel is cached, so this is not "now". */
  computedAt: Date;
  /** Candidate profiles + CVs the next run would delete outright. */
  candidates: RetentionBucket;
  /**
   * Candidates inside the warning window. Reported only: there is no email
   * provider in this repo yet (PLAN-PHASE2.md §8 Q5), so `db:purge` lists them
   * and sends nothing.
   */
  warnings: RetentionBucket;
  /** Applications whose personal columns would be NULLed (redaction, not deletion). */
  applications: RetentionBucket;
  /** consents rows whose authorised data was purged long enough ago. */
  consents: RetentionBucket;
  /** data_access_logs rows past their own retention. */
  accessLogs: RetentionBucket;
};

/**
 * `rows` is already ordered oldest-first by every find* function in
 * lib/db/retention.ts, so the head is the oldest — but this does not rely on
 * that, because a later ORDER BY change in the sweep should not silently make
 * this page report the wrong date.
 */
function bucket<T>(
  rows: T[],
  dateOf: (row: T) => Date,
  cutoff: Date,
  months: number,
): RetentionBucket {
  let oldest: Date | null = null;
  for (const row of rows) {
    const date = dateOf(row);
    if (oldest === null || date < oldest) oldest = date;
  }
  return { count: rows.length, oldest, cutoff, months };
}

async function computeRetentionSummary(): Promise<RetentionSummary> {
  // One `now` for every cutoff, as in scripts/db-purge.ts: five cutoffs derived
  // from five separate clock reads could straddle a month boundary and report a
  // set no single run would ever act on.
  const now = new Date();
  const candidateCutoff = monthsAgo(CANDIDATE_INACTIVITY_MONTHS, now);
  const warningCutoff = monthsAgo(CANDIDATE_WARNING_MONTHS, now);
  const applicationCutoff = monthsAgo(APPLICATION_REDACTION_MONTHS, now);
  const consentCutoff = monthsAgo(CONSENT_RETENTION_MONTHS, now);
  const accessLogCutoff = monthsAgo(ACCESS_LOG_RETENTION_MONTHS, now);

  const [dueCandidates, toWarn, dueApplications, dueConsents, dueAccessLogs] = await Promise.all([
    findCandidatesInactiveSince(candidateCutoff),
    findCandidatesToWarn(warningCutoff, candidateCutoff),
    findApplicationsToRedact(applicationCutoff),
    findConsentsToDelete(consentCutoff),
    findAccessLogsToDelete(accessLogCutoff),
  ]);

  return {
    computedAt: now,
    candidates: bucket(
      dueCandidates,
      (row) => row.lastActivityAt,
      candidateCutoff,
      CANDIDATE_INACTIVITY_MONTHS,
    ),
    warnings: bucket(toWarn, (row) => row.lastActivityAt, warningCutoff, CANDIDATE_WARNING_MONTHS),
    applications: bucket(
      dueApplications,
      (row) => row.jobClosedAt,
      applicationCutoff,
      APPLICATION_REDACTION_MONTHS,
    ),
    consents: bucket(dueConsents, (row) => row.purgedAt, consentCutoff, CONSENT_RETENTION_MONTHS),
    accessLogs: bucket(
      dueAccessLogs,
      (row) => row.createdAt,
      accessLogCutoff,
      ACCESS_LOG_RETENTION_MONTHS,
    ),
  };
}

export const getRetentionSummary = unstable_cache(
  computeRetentionSummary,
  ['retention-summary'],
  { revalidate: RETENTION_TTL_SECONDS },
);
