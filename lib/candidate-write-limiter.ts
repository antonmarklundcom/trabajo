// Rate limits for the authenticated candidate write endpoints
// (PLAN-PHASE3-DRAFT.md §12.1 / §13.4 B5).
//
// The anonymous public write paths have been limited since before B1
// (lib/public-write-limiter.ts); these two were not, on the implicit assumption
// that a session is a person. It is not — a session is a cookie, and a
// scripted or stolen one can spray writes as fast as the network allows. Both
// endpoints write rows the ARCO purge then has to carry, and
// `postulaciones` fans out to employer notifications, so an unbounded write
// loop is a mailbox flood as well as a table full of junk.
//
// Shape: `createRequestLimiter`, not `createAttemptLimiter`. The attempt
// limiter counts *failures* against a credential and clears on success, which
// is right for a password check and wrong here — a flood is made of successful
// writes, and none of them should be free. §13.4 B5 says "the same
// createAttemptLimiter pattern"; the pattern that transfers is B1's one
// module, one trusted key, own instance, and this is the shape inside that
// module whose semantics match a write. Recorded in the PR body rather than
// discovered later.
//
// ONE INSTANCE PER ENDPOINT, unlike lib/public-write-limiter.ts. Saving a job
// is a cheap idempotent toggle a browsing candidate legitimately hits many
// times in a session; applying is a heavier, rarer, irreversible write. They
// are different traffic shapes, which is exactly when lib/rate-limit.ts says
// the counters get separated.
import 'server-only';

import { createRequestLimiter } from './rate-limit';

const WINDOW_MS = 60_000;

// Applying to more than ten jobs in a minute is not a person reading postings.
const MAX_APPLICATIONS_PER_MINUTE = 10;

// Save/unsave is a toggle; a candidate skimming a results page taps it far
// more often than they apply, so this is deliberately looser.
const MAX_SAVES_PER_MINUTE = 30;

const applicationLimiter = createRequestLimiter(MAX_APPLICATIONS_PER_MINUTE, WINDOW_MS);
const savedJobLimiter = createRequestLimiter(MAX_SAVES_PER_MINUTE, WINDOW_MS);

/**
 * The bucket key for an authenticated write.
 *
 * Both halves are needed. The IP alone would let one abusive candidate throttle
 * everyone else behind the same NAT — common in Paraguay, where mobile carriers
 * put large numbers of subscribers behind a handful of addresses. The candidate
 * id alone would be free to escape by registering more accounts. Together the
 * budget is per person per origin, and the IP half is only meaningful because
 * it comes from `clientIpOrUnknown()` (lib/client-ip.ts) — keyed on the raw
 * leftmost x-forwarded-for entry this would limit nothing at all.
 */
function key(ip: string, candidateId: number): string {
  return `${ip}:${candidateId}`;
}

/** Records the application attempt and reports whether it is over the limit. */
export function isApplicationLimited(ip: string, candidateId: number): boolean {
  return applicationLimiter.isLimited(key(ip, candidateId));
}

/** Records the save/unsave and reports whether it is over the limit. */
export function isSavedJobLimited(ip: string, candidateId: number): boolean {
  return savedJobLimiter.isLimited(key(ip, candidateId));
}
