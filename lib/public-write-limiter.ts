// The anti-spam limiter for the two anonymous public write paths
// (POST /api/v1/leads and POST /api/publicar).
//
// It lives here rather than in lib/leads.ts because that module is imported by
// components/EmployerForm.tsx — a client component — for its Zod schema.
// Anything lib/leads.ts imports is reachable from the browser bundle, and
// lib/rate-limit.ts is `server-only`. The counters are also simply not
// something a client should be able to see the shape of.
//
// ONE instance, deliberately shared by both routes: they are the same anti-spam
// budget against the same anonymous public, which is how it behaved before B1
// moved the implementation. That is the exception that proves lib/rate-limit's
// rule — instances are separated when the audiences differ, and these two do
// not differ.
import 'server-only';

import { createRequestLimiter } from './rate-limit';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const publicWriteLimiter = createRequestLimiter(MAX_REQUESTS, WINDOW_MS);

/**
 * Records the request and reports whether it is over the limit.
 *
 * The IP must come from `clientIpOrUnknown()` (lib/client-ip.ts). Keyed on the
 * old leftmost x-forwarded-for entry this limiter did nothing: an attacker got
 * a fresh bucket per request just by varying a header.
 */
export function isRateLimited(ip: string): boolean {
  return publicWriteLimiter.isLimited(ip);
}
