// Retention periods — the numbers in PLAN-PHASE2.md §4.3, in one place.
//
// They live here rather than inline in scripts/db-purge.ts for two reasons.
// First, §8 Q1 is still open: the owner has to confirm these before PR 11,
// because the same numbers go into /privacidad, and changing them afterwards
// means re-consenting everyone. Making that a one-line edit to a named constant
// is the difference between "confirm the retention policy" and "audit the purge
// script". Second, a period that is written twice will eventually be written
// differently in the two places, and the copy that is wrong will be the one in
// the privacy policy.
//
// Months, not days: "24 months after last login" is what the policy says, and
// approximating it as 730 days drifts against the sentence a candidate read.

/** Candidate profile + CV: purged this long after the last login. */
export const CANDIDATE_INACTIVITY_MONTHS = 24;

/**
 * How long before the purge a candidate should be warned. §4.3 says a warning
 * at 23 months; there is no transactional email provider in this repo yet
 * (§8 Q5), so `db:purge` only *reports* who is in the window. Sending is the
 * follow-up once email exists — the sweep must not silently pass the point
 * where a warning was owed.
 */
export const CANDIDATE_WARNING_MONTHS = 23;

/** Application personal data: redacted this long after its job closed. */
export const APPLICATION_REDACTION_MONTHS = 12;

/**
 * `consents`: kept this long after the data the consent authorised is purged —
 * NOT after the consent was granted. The row is the evidence that the purge was
 * authorised, so it has to outlive what it authorised.
 */
export const CONSENT_RETENTION_MONTHS = 60;

/** `data_access_logs`: 24 months from the access. */
export const ACCESS_LOG_RETENTION_MONTHS = 24;

/**
 * `contact_messages` (/contacto): hard-deleted this long after they arrived.
 *
 * /privacidad states no period for contact messages — §2 and §3 say we collect
 * them to answer the query, and nothing more — so this is the working default,
 * chosen to match APPLICATION_REDACTION_MONTHS rather than invented afresh: a
 * question answered a year ago has no remaining purpose. It is NOT yet quoted
 * in /privacidad; the owner confirms it before it is (same §8 Q1 rule as the
 * rest of this file).
 */
export const CONTACT_MESSAGE_RETENTION_MONTHS = 12;

/**
 * `job_alerts` that were never confirmed: hard-deleted this many DAYS after the
 * subscribe. An unconfirmed alert is an address somebody typed that nobody has
 * yet shown they own — it may not even be the subscriber's — so it is kept only
 * as long as a confirmation link could plausibly still be clicked.
 */
export const JOB_ALERT_UNCONFIRMED_DAYS = 7;

/**
 * Confirmed `job_alerts` with no successful send for this long are
 * hard-deleted. The clock is the last send (or the confirmation, for an alert
 * that never matched anything): a filter that has produced nothing in a year
 * is an address kept for no purpose. Quoted in /privacidad §10, together with
 * JOB_ALERT_UNCONFIRMED_DAYS: changing either changes the published policy.
 */
export const JOB_ALERT_INACTIVITY_MONTHS = 12;

/** `now` shifted back by whole days, for the one period stated in days. */
export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * `now` shifted back by whole months. Uses UTC parts rather than subtracting
 * milliseconds so "24 months ago" lands on the same day of the month, and
 * clamps day-of-month overflow (31 March minus 1 month is 28/29 February, not
 * 2/3 March) — an off-by-a-few-days cutoff on a purge is a deletion that
 * happened before the policy allowed it.
 */
export function monthsAgo(months: number, now: Date = new Date()): Date {
  const result = new Date(now.getTime());
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return result;
}
