// In-memory login attempt limiter, factored out of lib/auth.ts so the staff and
// candidate login paths (PLAN-PHASE2.md §2.1) share one implementation instead
// of two copies that drift.
//
// Each caller creates its OWN limiter instance. That is deliberate: a burst of
// candidate login attempts must not consume an employer's budget, and the two
// audiences have different traffic shapes. Sharing the code is the point;
// sharing the counters is not.
//
// Per-process and therefore per-deployment. Hostinger runs this app as a single
// Node process, so it holds for the deployment this repo targets; it resets on
// deploy and would not cover a horizontally scaled setup. It exists to blunt
// credential stuffing, not to be an audited quota system — if the app is ever
// scaled out, move this to a table.
import 'server-only';

type Attempt = { count: number; firstAt: number };

export type AttemptLimiter = {
  /** Call BEFORE checking the password. */
  check(ip: string, identifier: string): { allowed: boolean; retryAfterSeconds: number };
  /** Call after a failed attempt. */
  recordFailure(ip: string, identifier: string): void;
  /** Call after a success, so a legitimate user is not left throttled. */
  clear(ip: string, identifier: string): void;
};

/**
 * Two buckets per limiter, and the reason is the whole point of PR B1.
 *
 * `ip:identifier` is the strict one (5 per 15 min). It was chosen so that a
 * stranger cannot lock a known-good account out by hammering it from
 * somewhere else — that property is deliberate and is kept.
 *
 * But it only binds an attacker who cannot change the IP half of the key, and
 * with lib/client-ip.ts in place that is now true of anyone forging headers —
 * NOT of anyone with a botnet, a proxy pool, or a phone's mobile network. So a
 * second, much looser bucket keyed on the identifier ALONE puts a ceiling on
 * guesses against one account no matter where they come from.
 *
 * The tradeoff is real and is chosen with open eyes: an identifier-only bucket
 * means an attacker who knows an email address can push that account to 429 for
 * the rest of the window. That is a bounded, self-healing denial of one
 * account's logins for fifteen minutes. The alternative it replaces is
 * unbounded password guessing against that same account. Those are not close.
 *
 * The ceiling is set high enough (4x the per-IP allowance) that it is not what
 * an ordinary user meets — a person who fails five times has already been
 * stopped by the strict bucket, and a shared office NAT trips neither.
 */
const IDENTITY_ATTEMPT_MULTIPLIER = 4;

export function createAttemptLimiter(maxAttempts: number, windowMs: number): AttemptLimiter {
  const attempts = new Map<string, Attempt>();
  const identityMax = maxAttempts * IDENTITY_ATTEMPT_MULTIPLIER;

  // Keyed on IP + identifier so that one attacker cannot lock a known-good
  // account out by hammering it from somewhere else.
  const keyFor = (ip: string, identifier: string) => `${ip}:${identifier.trim().toLowerCase()}`;
  // The identifier-only bucket. Prefixed so it can never collide with a
  // keyFor() key, whatever an identifier happens to contain.
  const identityKeyFor = (identifier: string) => `id\u0000${identifier.trim().toLowerCase()}`;

  function prune(now: number) {
    // Bounded cleanup so a stream of unique keys cannot grow the map forever.
    for (const [key, attempt] of attempts) {
      if (now - attempt.firstAt > windowMs) attempts.delete(key);
    }
  }

  function live(key: string, now: number): Attempt | null {
    const attempt = attempts.get(key);
    if (!attempt || now - attempt.firstAt > windowMs) return null;
    return attempt;
  }

  function bump(key: string, now: number) {
    const attempt = live(key, now);
    if (!attempt) {
      attempts.set(key, { count: 1, firstAt: now });
      return;
    }
    attempt.count += 1;
  }

  return {
    check(ip, identifier) {
      const now = Date.now();
      prune(now);

      // Either bucket can deny. Whichever is over its limit reports the wait,
      // and when both are the caller is told the longer of the two.
      const blocked = [
        [live(keyFor(ip, identifier), now), maxAttempts] as const,
        [live(identityKeyFor(identifier), now), identityMax] as const,
      ]
        .filter(([attempt, max]) => attempt !== null && attempt.count >= max)
        .map(([attempt]) => Math.ceil((windowMs - (now - attempt!.firstAt)) / 1000));

      if (blocked.length === 0) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.max(...blocked) };
    },

    recordFailure(ip, identifier) {
      const now = Date.now();
      bump(keyFor(ip, identifier), now);
      bump(identityKeyFor(identifier), now);
    },

    clear(ip, identifier) {
      // A success clears both, so an honest user who finally gets it right is
      // not left throttled by their own earlier typos — including when those
      // typos came from another device on another network.
      attempts.delete(keyFor(ip, identifier));
      attempts.delete(identityKeyFor(identifier));
    },
  };
}

/**
 * A sliding window over REQUESTS, not failures — for endpoints where every call
 * costs something whether or not it succeeds (the public lead form, and the
 * authenticated candidate writes in PR B5).
 *
 * Lives here rather than in lib/leads.ts, which had its own hand-rolled copy
 * (PLAN-PHASE3-DRAFT.md §12.1, "two independent in-memory rate limiters"). The
 * shapes genuinely differ — an attempt limiter counts failures and is cleared
 * by success, this one counts everything — so they stay two functions. What
 * they must not be is two implementations of the same single-process fragility
 * in two files, because §14 D3 is a decision about ALL of it at once.
 */
export type RequestLimiter = {
  /** Records the request and reports whether it exceeded the window's budget. */
  isLimited(key: string): boolean;
};

export function createRequestLimiter(maxRequests: number, windowMs: number): RequestLimiter {
  const timestamps = new Map<string, number[]>();

  return {
    isLimited(key) {
      const now = Date.now();

      // Prune every call, like the attempt limiter: without it a stream of
      // distinct keys grows the map for the process's lifetime.
      for (const [existing, times] of timestamps) {
        const live = times.filter((t) => now - t < windowMs);
        if (live.length === 0) timestamps.delete(existing);
        else timestamps.set(existing, live);
      }

      const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      timestamps.set(key, recent);
      return recent.length > maxRequests;
    },
  };
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * The public lead form's budget: 5 submissions per minute per IP.
 *
 * The instance lives here rather than in lib/leads.ts because that module is
 * imported by client components (HONEYPOT_FIELD), so anything it imports ships
 * to the browser. Keeping the limiter here is what lets this module keep its
 * `server-only` guarantee while lib/leads.ts keeps being importable from a
 * form component.
 */
const leadSubmissionLimiter = createRequestLimiter(5, 60_000);

export function isLeadRateLimited(ip: string): boolean {
  return leadSubmissionLimiter.isLimited(ip);
}
