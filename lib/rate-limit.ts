// The app's only rate-limiting implementation. Two shapes, one module:
//
//   - `createAttemptLimiter` for credential checks, keyed on who is being
//     attacked as well as where from.
//   - `createRequestLimiter` for anonymous request floods, keyed on origin
//     alone. This was a second, separate sliding window in lib/leads.ts until
//     B1; the counters were never the problem, the drift was.
//
// Each caller creates its OWN instance. That is deliberate: a burst of
// candidate login attempts must not consume an employer's budget, the two
// audiences have different traffic shapes, and — the bug §13.3 found — a
// failed password confirmation on the ARCO deletion page must not eat the
// login budget of the account trying to delete itself. Sharing the code is the
// point; sharing the counters is not.
//
// Per-process and therefore per-deployment. Hostinger runs this app as a single
// Node process, so it holds for the deployment this repo targets; it resets on
// deploy and would not cover a horizontally scaled setup. It exists to blunt
// credential stuffing, not to be an audited quota system — if the app is ever
// scaled out, move this to a table.
//
// Every caller keys these on `clientIpOrUnknown()` from lib/client-ip.ts. A
// limiter keyed on a client-suppliable value does not limit anything.
import 'server-only';

type Attempt = { count: number; firstAt: number };

export type LimitDecision = { allowed: boolean; retryAfterSeconds: number };

export type AttemptLimiter = {
  /** Call BEFORE checking the password. */
  check(ip: string, identifier: string): LimitDecision;
  /** Call after a failed attempt. */
  recordFailure(ip: string, identifier: string): void;
  /** Call after a success, so a legitimate user is not left throttled. */
  clear(ip: string, identifier: string): void;
};

export type AttemptLimiterOptions = {
  /** Attempts allowed per (ip, identifier) pair within `windowMs`. */
  maxAttempts: number;
  windowMs: number;
  /**
   * Attempts allowed against ONE identifier from all origins combined, within
   * `identityWindowMs`. See the note on the identity bucket below.
   */
  maxPerIdentity: number;
  identityWindowMs: number;
};

function sweep(buckets: Map<string, Attempt>, now: number, windowMs: number) {
  // Bounded cleanup so a stream of unique keys cannot grow the map forever.
  for (const [key, attempt] of buckets) {
    if (now - attempt.firstAt > windowMs) buckets.delete(key);
  }
}

function decide(
  attempt: Attempt | undefined,
  now: number,
  max: number,
  windowMs: number,
): LimitDecision {
  if (!attempt || now - attempt.firstAt > windowMs) return { allowed: true, retryAfterSeconds: 0 };
  if (attempt.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - attempt.firstAt)) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function bump(buckets: Map<string, Attempt>, key: string, now: number, windowMs: number) {
  const attempt = buckets.get(key);
  if (!attempt || now - attempt.firstAt > windowMs) {
    buckets.set(key, { count: 1, firstAt: now });
    return;
  }
  attempt.count += 1;
}

export function createAttemptLimiter(options: AttemptLimiterOptions): AttemptLimiter {
  const { maxAttempts, windowMs, maxPerIdentity, identityWindowMs } = options;

  // Keyed on IP + identifier so that one attacker cannot lock a known-good
  // account out by hammering it from somewhere else. This stays the primary
  // bucket for exactly that reason.
  const perOrigin = new Map<string, Attempt>();

  // The second bucket, keyed on identity alone. Pinning the trusted hop stops
  // one attacker forging many origins; it does nothing about one attacker who
  // genuinely HAS many origins, and a botnet spreading attempts across
  // thousands of real IPs never fills a per-origin bucket.
  //
  // The tension with the paragraph above is real and is resolved by the
  // numbers, not by the structure: this bucket is set high enough and wide
  // enough that reaching it is evidence of an attack rather than of a person
  // who forgot their password, and it expires on its own — it throttles for the
  // rest of the window, it does not lock an account until someone intervenes.
  // A denial-of-service against one known account is still possible at that
  // cost, and that is the accepted trade: the alternative is leaving
  // distributed credential stuffing unbounded.
  const perIdentity = new Map<string, Attempt>();

  const originKey = (ip: string, identifier: string) =>
    `${ip}:${identifier.trim().toLowerCase()}`;
  const identityKey = (identifier: string) => identifier.trim().toLowerCase();

  return {
    check(ip, identifier) {
      const now = Date.now();
      sweep(perOrigin, now, windowMs);
      sweep(perIdentity, now, identityWindowMs);

      const origin = decide(perOrigin.get(originKey(ip, identifier)), now, maxAttempts, windowMs);
      if (!origin.allowed) return origin;

      return decide(
        perIdentity.get(identityKey(identifier)),
        now,
        maxPerIdentity,
        identityWindowMs,
      );
    },

    recordFailure(ip, identifier) {
      const now = Date.now();
      bump(perOrigin, originKey(ip, identifier), now, windowMs);
      bump(perIdentity, identityKey(identifier), now, identityWindowMs);
    },

    clear(ip, identifier) {
      // Only the origin bucket is cleared on success. The identity bucket
      // deliberately survives: in a distributed attack the one success that
      // matters is the attacker's, and letting it reset the account-wide
      // counter would hand back the budget at exactly the wrong moment.
      perOrigin.delete(originKey(ip, identifier));
    },
  };
}

export type RequestLimiter = {
  /** Records the request and reports whether it is over the limit. */
  isLimited(key: string): boolean;
};

/**
 * Sliding-window limiter for anonymous request floods, keyed on origin alone.
 * Moved here from lib/leads.ts so there is one module to audit; the semantics
 * (record-then-test, so the Nth request is the one refused) are unchanged.
 */
export function createRequestLimiter(maxRequests: number, windowMs: number): RequestLimiter {
  const timestamps = new Map<string, number[]>();

  return {
    isLimited(key) {
      const now = Date.now();
      const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      timestamps.set(key, recent);

      // Same unbounded-growth guard as the attempt limiter: drop keys whose
      // whole window has aged out.
      if (timestamps.size > 1000) {
        for (const [k, times] of timestamps) {
          if (times.every((t) => now - t >= windowMs)) timestamps.delete(k);
        }
      }

      return recent.length > maxRequests;
    },
  };
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// One identifier, all origins. Thirty failures against a single account in an
// hour is not a person who forgot their password.
export const MAX_IDENTITY_ATTEMPTS = 30;
export const IDENTITY_WINDOW_MS = 60 * 60 * 1000;

/** The shape every credential path in this app uses. */
export const LOGIN_LIMITS: AttemptLimiterOptions = {
  maxAttempts: MAX_LOGIN_ATTEMPTS,
  windowMs: LOGIN_WINDOW_MS,
  maxPerIdentity: MAX_IDENTITY_ATTEMPTS,
  identityWindowMs: IDENTITY_WINDOW_MS,
};
