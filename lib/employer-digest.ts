// The weekly employer summary ("Resumen semanal"): the rules, the data shape,
// and the command-line switch — everything about it that can be decided
// without a database.
//
// Why this exists at all. The business sells Destacado and the Empresa
// package and gives basic listings away; an employer renews and pays when they
// SEE results. /empresa already shows the numbers (jobs.view_count, the
// applicant counts), but nobody opens a dashboard to check on a listing they
// have stopped thinking about. The summary brings the numbers to the inbox,
// and with them the renewal moment.
//
// Kept apart from the three places that use it so that each property below is
// stated once and evaluated directly by scripts/verify-digest.ts:
//
//   - lib/db/employer.ts reads the data, scoped by companyId like everything
//     else there, and returns it as `DigestListing`.
//   - lib/emails/employer.ts turns it into the email, as a pure function.
//   - scripts/employer-digest.ts decides who gets one and sends it.
//
// Not `server-only`: nothing here touches a secret or the database, and the
// verify script evaluates these functions under plain tsx.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Never two summaries within this many days. Six, not seven, so a weekly cron
 * that fires a few minutes EARLIER than last week's run (a slow previous run,
 * a cron daemon restart, a manual run on Friday followed by Monday's schedule)
 * still sends, while a cron that fires twice, or an operator re-running the
 * script by hand after a scheduled run, does not mail the same summary again.
 */
export const DIGEST_MIN_INTERVAL_DAYS = 6;

/**
 * The application window for a company's FIRST summary, when there is no
 * previous send to count from. After that, the window is "since the last
 * summary", so a week the send failed is folded into the next one instead of
 * disappearing.
 */
export const DIGEST_FIRST_PERIOD_DAYS = 7;

/**
 * One listing in the summary. THIS TYPE IS THE PRIVACY BOUNDARY.
 *
 * lib/emails/employer.ts states the rule for every employer email: no
 * applicant personal data, ever — email is not an authorized channel for a
 * candidate's data, the session-gated panel is. The summary is where that rule
 * is easiest to break by accident, because it is the one employer email built
 * from query results about applications rather than from a single event. So
 * the shape the template receives has no field that COULD carry a name, a
 * phone, an address, a message or a CV: applications arrive as a count and
 * nothing else. scripts/verify-digest.ts asserts this key list from source; a
 * new field here is a new line in that check, which is the point.
 *
 * Everything else is public (title, slug — they are on the posting) or the
 * company's own aggregate (views, dates).
 */
export type DigestListing = {
  jobId: number;
  title: string;
  slug: string;
  /** Cumulative `jobs.view_count`. */
  viewCount: number;
  /** `view_count - view_count_at_digest`, clamped at zero. */
  viewsSinceDigest: number;
  /** COUNT of applications received in the period. A number, never rows. */
  applicationsInPeriod: number;
  expiresAt: Date | null;
  featuredUntil: Date | null;
};

/** What the email builder needs about the company, beyond its listings. */
export type EmployerDigest = {
  companyName: string;
  /** `companies.last_digest_sent_at` before this send; null on the first one. */
  previousDigestAt: Date | null;
  /** The run's single clock — every "is it expiring / featured" is against this. */
  now: Date;
  listings: readonly DigestListing[];
};

/**
 * Why a company gets no summary this run, or null when it gets one.
 *
 * Two of the four reasons are known from the company row alone and are checked
 * first, so a skipped company costs one query rather than three. The other two
 * need the per-company reads; `digestSkipReason()` takes their results so the
 * whole decision is still ONE function the verify script can evaluate.
 *
 * Order matters for what the dry run prints, not for what happens: each reason
 * alone is enough to skip.
 */
export type DigestSkipReason = 'opted_out' | 'recently_sent' | 'no_public_listings' | 'no_recipients';

export function digestCompanySkipReason(
  company: { notifyWeeklyDigest: boolean; lastDigestSentAt: Date | null },
  now: Date,
): 'opted_out' | 'recently_sent' | null {
  if (!company.notifyWeeklyDigest) return 'opted_out';
  if (
    company.lastDigestSentAt &&
    now.getTime() - company.lastDigestSentAt.getTime() < DIGEST_MIN_INTERVAL_DAYS * DAY_MS
  ) {
    return 'recently_sent';
  }
  return null;
}

export function digestSkipReason(
  company: { notifyWeeklyDigest: boolean; lastDigestSentAt: Date | null },
  now: Date,
  counts: { listings: number; recipients: number },
): DigestSkipReason | null {
  const early = digestCompanySkipReason(company, now);
  if (early) return early;
  if (counts.listings === 0) return 'no_public_listings';
  if (counts.recipients === 0) return 'no_recipients';
  return null;
}

/**
 * Where "new applications" start counting: the previous summary, or
 * DIGEST_FIRST_PERIOD_DAYS back on the first one. Views need no such date —
 * their delta is the stored snapshot, written by the same successful send that
 * writes `last_digest_sent_at`, so the two windows always start together.
 */
export function digestPeriodStart(previousDigestAt: Date | null, now: Date): Date {
  return previousDigestAt ?? new Date(now.getTime() - DIGEST_FIRST_PERIOD_DAYS * DAY_MS);
}

/** True while a Destacado window is open — the same `featured_until > NOW()` predicate as everywhere. */
export function isFeaturedAt(featuredUntil: Date | null, now: Date): boolean {
  return featuredUntil !== null && featuredUntil.getTime() > now.getTime();
}

/**
 * The script's switches. Here rather than in the script so that "no send
 * without --apply" is a property of a function the verify script can call, not
 * only of a file it can read.
 */
export const DIGEST_ARGS = ['--apply', '--verbose', '--help', '-h'] as const;

export function parseDigestArgs(argv: readonly string[]) {
  const apply = argv.includes('--apply');
  const verbose = argv.includes('--verbose');
  const help = argv.includes('--help') || argv.includes('-h');
  const unknown = argv.filter(
    (arg) => arg.startsWith('-') && !(DIGEST_ARGS as readonly string[]).includes(arg),
  );
  return { apply, verbose, help, unknown };
}
