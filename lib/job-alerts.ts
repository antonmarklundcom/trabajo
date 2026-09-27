// "Avisame de empleos nuevos" — the rules, the data shape and the command-line
// switch: everything about job alerts that can be decided without a database.
//
// Same split as lib/employer-digest.ts, for the same reason — each property is
// stated once here and evaluated directly by scripts/verify-alerts.ts:
//
//   - lib/db/job-alerts.ts writes and reads the job_alerts rows (and their
//     consents) and nothing else;
//   - the JOBS come from lib/data.ts, the public catalogue seam, so an alert can
//     only ever list what the visibility predicate already lets anyone see;
//   - lib/emails/job-alerts.ts turns the result into the email, as a pure
//     function;
//   - scripts/job-alerts.ts decides who is due and sends.
//
// What an alert is, and what it is not: it matches JOBS to a filter the person
// stated themselves (categoría and/or ciudad). Nothing here looks at who the
// subscriber is, scores them, or ranks them against anyone — that is the
// candidate matching AGENTS.md puts off-limits until legal review.
//
// Not `server-only`: nothing here touches a secret or the database, and the
// verify script evaluates these functions under plain tsx. Client components
// import JOB_ALERT_EMAIL_MAX from here too.
import type { Job } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Never two alert emails to one row within this many days (weekly, with slack — see lib/employer-digest.ts). */
export const JOB_ALERT_MIN_INTERVAL_DAYS = 6;

/** The window for a row that has never been sent anything. */
export const JOB_ALERT_FIRST_PERIOD_DAYS = 7;

/** Listings per email. The rest are one link away. */
export const JOB_ALERT_MAX_JOBS = 10;

/**
 * Alerts per address. Past this, a subscribe answers exactly as if it had
 * worked and sends nothing: the confirmation email is the one thing this form
 * sends to an address its submitter may not own, and a cap on how many one
 * address can be made to receive is the mail-bomb brake.
 */
export const JOB_ALERTS_PER_EMAIL_MAX = 10;

/**
 * A second subscribe for the same still-unconfirmed alert re-sends the same
 * confirmation link — but not more often than this. Somebody who lost the
 * email gets it again; somebody submitting a stranger's address in a loop gets
 * one email per interval, not one per click.
 */
export const JOB_ALERT_RESEND_MINUTES = 10;

/** RFC 5321 path limit; matches job_alerts.email. */
export const JOB_ALERT_EMAIL_MAX = 320;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Lowercased and trimmed — the one form an address is stored and compared in. */
export function normalizeAlertEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAlertEmail(email: string): boolean {
  return email.length > 0 && email.length <= JOB_ALERT_EMAIL_MAX && EMAIL_RE.test(email);
}

// ---------------------------------------------------------------------------
// Presentation (shared by the form, the pages and the emails)
// ---------------------------------------------------------------------------

/**
 * "de Ventas en Asunción" / "de Ventas" / "en Asunción" / "" — the tail of
 * "Recibí los nuevos empleos …". Takes display NAMES, not slugs: the callers
 * resolve them (the pages from lib/data.ts, the emails via lib/labels.ts).
 */
export function alertFilterPhrase(categoryName: string | null, cityName: string | null): string {
  if (categoryName && cityName) return `de ${categoryName} en ${cityName}`;
  if (categoryName) return `de ${categoryName}`;
  if (cityName) return `en ${cityName}`;
  return '';
}

/**
 * The indexable landing that lists exactly this filter — the "ver todos" link
 * in the email. The same URL tier /empleos?categoria=&ciudad= canonicalises
 * to (lib/seo.ts), so an alert never links a visitor to a noindexed variant.
 */
export function alertListingPath(categorySlug: string | null, citySlug: string | null): string {
  if (categorySlug && citySlug) return `/trabajo/${categorySlug}/${citySlug}`;
  if (categorySlug) return `/trabajo/${categorySlug}`;
  if (citySlug) return `/trabajo-en/${citySlug}`;
  return '/empleos';
}

// ---------------------------------------------------------------------------
// The sender's rules
// ---------------------------------------------------------------------------

export type AlertSkipReason = 'unconfirmed' | 'recently_sent' | 'no_new_jobs';

/**
 * Why a row gets no email this run, or null when it is due. The first two are
 * known from the row alone; `newJobs` is the count after matching.
 */
export function alertSkipReason(
  alert: { confirmedAt: Date | null; lastSentAt: Date | null },
  now: Date,
  newJobs?: number,
): AlertSkipReason | null {
  if (!alert.confirmedAt) return 'unconfirmed';
  if (
    alert.lastSentAt &&
    now.getTime() - alert.lastSentAt.getTime() < JOB_ALERT_MIN_INTERVAL_DAYS * DAY_MS
  ) {
    return 'recently_sent';
  }
  if (newJobs !== undefined && newJobs === 0) return 'no_new_jobs';
  return null;
}

/**
 * Where "new" starts: the last successful send, or JOB_ALERT_FIRST_PERIOD_DAYS
 * back. A run whose send failed leaves last_sent_at alone, so those jobs are
 * still "new" next time instead of disappearing.
 */
export function alertWindowStart(lastSentAt: Date | null, now: Date): Date {
  return lastSentAt ?? new Date(now.getTime() - JOB_ALERT_FIRST_PERIOD_DAYS * DAY_MS);
}

/**
 * The listings published after `since` (and not after `now`) that match the
 * alert's filter, newest first. `jobs` is whatever lib/data.ts returned — the
 * visibility predicate has already run; this only narrows further. The
 * filter is re-applied here even though the caller already passed it to
 * getJobs(), so a caller that fetched a wider page cannot leak another
 * category's listing into someone's inbox.
 */
export function selectNewJobs(
  jobs: readonly Job[],
  filter: { categorySlug: string | null; citySlug: string | null },
  since: Date,
  now: Date,
): Job[] {
  return jobs
    .filter((job) => {
      if (filter.categorySlug && job.categorySlug !== filter.categorySlug) return false;
      if (filter.citySlug && job.citySlug !== filter.citySlug) return false;
      const posted = Date.parse(job.postedAt);
      return Number.isFinite(posted) && posted > since.getTime() && posted <= now.getTime();
    })
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}

/**
 * Whether a page walk over getJobs(orden: 'recientes') can stop. That order is
 * "live featured first, then published_at DESC" (lib/db/queries.ts), so once a
 * page ENDS on a non-featured listing older than the window, every later page
 * is non-featured and older still.
 */
export function canStopPaging(page: readonly Job[], since: Date, now: Date): boolean {
  const last = page[page.length - 1];
  if (!last) return true;
  const featured = last.featuredUntil !== null && Date.parse(last.featuredUntil) > now.getTime();
  return !featured && Date.parse(last.postedAt) <= since.getTime();
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

/**
 * The script's switches. Here rather than in the script so that "no send
 * without --apply" is a property of a function the verify script can call.
 */
export const ALERT_ARGS = ['--apply', '--verbose', '--help', '-h'] as const;

export function parseAlertArgs(argv: readonly string[]) {
  const apply = argv.includes('--apply');
  const verbose = argv.includes('--verbose');
  const help = argv.includes('--help') || argv.includes('-h');
  const unknown = argv.filter(
    (arg) => arg.startsWith('-') && !(ALERT_ARGS as readonly string[]).includes(arg),
  );
  return { apply, verbose, help, unknown };
}
