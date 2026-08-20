// Error tracking (PLAN-NEXT.md §3 O1).
//
// Three properties, and the reasons they are here rather than at eleven call
// sites:
//
//   1. **No-op when NEXT_PUBLIC_SENTRY_DSN is unset.** CI has no DSN, and
//      neither does a local checkout. `Sentry.captureException` on an
//      uninitialised client is already a no-op, but the guard is explicit so
//      "does this do anything without configuration?" is answerable by reading
//      one function.
//   2. **The console.error survives.** Hostinger's own log is the fallback
//      when the DSN is unset and the record of last resort when Sentry is
//      down; replacing a log line with a network call would be a downgrade
//      on the day it matters.
//   3. **Never throws.** An error reporter that can throw inside a catch block
//      turns a handled failure into an unhandled one. Same reasoning as
//      lib/email.ts and lib/db/auth-events.ts.
//
// What must NEVER be passed as `extra`: request bodies, email addresses,
// phone numbers, CV bytes or filenames, session cookies, reset tokens.
// `beforeSend` in the init options scrubs what it can reach, but it cannot
// un-know something a caller deliberately attached — so the rule lives here,
// where the callers read it.
import * as Sentry from '@sentry/nextjs';

/** Whether a DSN is configured at all. */
export function sentryEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Logs the error and, when a DSN is configured, reports it.
 *
 * `context` is a short stable tag ('cv:admin-download'), not a message — it is
 * what groups these in Sentry's UI and what makes an alert readable.
 */
export function captureError(
  context: string,
  err: unknown,
  extra?: Record<string, string | number | boolean | null>,
): void {
  console.error(`[${context}]`, err, extra ?? '');

  if (!sentryEnabled()) return;

  try {
    Sentry.captureException(err, {
      tags: { context },
      extra,
    });
  } catch {
    // Reporting the failure to report is not worth a second failure mode.
  }
}
