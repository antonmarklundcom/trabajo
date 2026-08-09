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

export function createAttemptLimiter(maxAttempts: number, windowMs: number): AttemptLimiter {
  const attempts = new Map<string, Attempt>();

  // Keyed on IP + identifier so that one attacker cannot lock a known-good
  // account out by hammering it from somewhere else.
  const keyFor = (ip: string, identifier: string) => `${ip}:${identifier.trim().toLowerCase()}`;

  function prune(now: number) {
    // Bounded cleanup so a stream of unique keys cannot grow the map forever.
    for (const [key, attempt] of attempts) {
      if (now - attempt.firstAt > windowMs) attempts.delete(key);
    }
  }

  return {
    check(ip, identifier) {
      const now = Date.now();
      prune(now);

      const attempt = attempts.get(keyFor(ip, identifier));
      if (!attempt || now - attempt.firstAt > windowMs) {
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (attempt.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((windowMs - (now - attempt.firstAt)) / 1000),
        };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },

    recordFailure(ip, identifier) {
      const now = Date.now();
      const key = keyFor(ip, identifier);
      const attempt = attempts.get(key);

      if (!attempt || now - attempt.firstAt > windowMs) {
        attempts.set(key, { count: 1, firstAt: now });
        return;
      }
      attempt.count += 1;
    },

    clear(ip, identifier) {
      attempts.delete(keyFor(ip, identifier));
    },
  };
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
