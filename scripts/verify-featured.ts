// Asserts the Destacado window arithmetic (lib/featured.ts).
//
//   npm run featured:verify
//
// Why this is worth a script. `featured_until` is what a customer paid for, and
// every way of getting it wrong is invisible: the listing still renders, the
// badge still shows, and the only person who notices is the employer whose
// 60 days quietly became 30 — a month later, in a WhatsApp message.
//
// Three cases, all of them ones a plausible one-line implementation gets wrong:
//   1. `featured_until = now + days` shortens a renewal bought mid-window.
//   2. Extending from a LAPSED date back-dates the new window, and for a window
//      that closed longer ago than the purchase is long, produces a date still
//      in the past — a paid Destacado that is invisible from the moment of
//      sale.
//   3. A duration nobody sells slipping through the closed list.
//
// Pure functions. No database, no env, no network.
import {
  FEATURE_DURATION_DAYS,
  FEATURE_PAYMENT_LABELS,
  FEATURE_PAYMENT_METHODS,
  computeFeaturedUntil,
  isFeatureDuration,
} from '../lib/featured';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-08-28T12:00:00.000Z');
const days = (n: number) => new Date(now.getTime() + n * DAY);

// ---------------------------------------------------------------------------
// 1. A fresh grant runs from now.
// ---------------------------------------------------------------------------

check(
  'a first grant of 30 days ends 30 days from now',
  computeFeaturedUntil(now, null, 30, false).getTime() === days(30).getTime(),
  computeFeaturedUntil(now, null, 30, false).toISOString(),
);

check(
  'extend:true with no previous window still starts from now',
  computeFeaturedUntil(now, null, 30, true).getTime() === days(30).getTime(),
  'Nothing to extend is a fresh window, not an error and not a no-op.',
);

// ---------------------------------------------------------------------------
// 2. Renewing an OPEN window adds to it — never truncates it.
// ---------------------------------------------------------------------------

const openUntil = days(20);

check(
  'extending a window with 20 days left adds to that date',
  computeFeaturedUntil(now, openUntil, 30, true).getTime() === days(50).getTime(),
  computeFeaturedUntil(now, openUntil, 30, true).toISOString(),
);

check(
  'extending never shortens an open window',
  computeFeaturedUntil(now, openUntil, 15, true).getTime() > openUntil.getTime(),
  'A renewal bought mid-window that ends earlier than the window it renewed is ' +
    'the exact bug `featured_until = now + days` produces.',
);

check(
  'extend:false deliberately RESTARTS an open window from now',
  computeFeaturedUntil(now, openUntil, 30, false).getTime() === days(30).getTime(),
  'This is the correction path (a mis-keyed grant), so it must be reachable — ' +
    'but only when the caller asks for it explicitly.',
);

// ---------------------------------------------------------------------------
// 3. Extending a LAPSED window starts from now, never from the lapsed date.
// ---------------------------------------------------------------------------

const lapsedRecently = days(-5);
const lapsedLongAgo = days(-400);

check(
  'extending a window that closed 5 days ago runs from now',
  computeFeaturedUntil(now, lapsedRecently, 30, true).getTime() === days(30).getTime(),
  computeFeaturedUntil(now, lapsedRecently, 30, true).toISOString(),
);

check(
  'a grant on a long-lapsed listing is never in the past',
  computeFeaturedUntil(now, lapsedLongAgo, 15, true).getTime() > now.getTime(),
  'Adding 15 days to a date 400 days old would sell a window that was already ' +
    'over when it was bought.',
);

check(
  'every offered duration produces a future date, on every prior state',
  FEATURE_DURATION_DAYS.every((d) =>
    [null, openUntil, lapsedRecently, lapsedLongAgo].every((prev) =>
      [true, false].every((ext) => computeFeaturedUntil(now, prev, d, ext).getTime() > now.getTime()),
    ),
  ),
);

// ---------------------------------------------------------------------------
// 4. The closed list is closed, and every method has Spanish copy.
// ---------------------------------------------------------------------------

check(
  'every offered duration is accepted by the validator',
  FEATURE_DURATION_DAYS.every((d) => isFeatureDuration(d)),
);

check(
  'a duration nobody sells is rejected',
  ![0, -30, 1, 45, 365, 3650, 1.5, NaN, Infinity].some((d) => isFeatureDuration(d)),
  'The route handler validates with this predicate, so anything it accepts is ' +
    'sellable by a hand-written request.',
);

check(
  'every payment method has a Spanish label',
  FEATURE_PAYMENT_METHODS.every((m) => (FEATURE_PAYMENT_LABELS[m] ?? '').length > 0),
  'UI copy is Spanish (Paraguay) — AGENTS.md. A missing label renders blank.',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll Destacado window assertions passed.');
process.exit(0);
