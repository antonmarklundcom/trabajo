// Asserts the date arithmetic behind the retention sweep (PLAN-PHASE2.md §4.3).
//
// Everything else in `db:purge` is SQL and needs a database, but the cutoff
// calculation is pure — and it is the part where being wrong is silent. A
// month subtraction that overshoots by three days deletes data three days
// before the policy allowed it, and nothing in the output looks different. So
// this runs in CI on every push, next to storage:verify, rather than being
// checked the day someone reads lib/retention.ts.
//
// No database, no bucket, no env: pure functions only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCESS_LOG_RETENTION_MONTHS,
  APPLICATION_REDACTION_MONTHS,
  CANDIDATE_INACTIVITY_MONTHS,
  CANDIDATE_WARNING_MONTHS,
  CONSENT_RETENTION_MONTHS,
  monthsAgo,
} from '../lib/retention';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
}

function iso(date: Date): string {
  return date.toISOString();
}

console.log('Retention cutoffs (PLAN-PHASE2.md §4.3)\n');

// The periods themselves. These numbers are quoted in /privacidad once §8 Q1 is
// answered, so a silent edit here is a silent edit to a published promise.
check('candidate inactivity is 24 months', CANDIDATE_INACTIVITY_MONTHS, 24);
check('candidate warning is 23 months', CANDIDATE_WARNING_MONTHS, 23);
check('warning comes before the purge', CANDIDATE_WARNING_MONTHS < CANDIDATE_INACTIVITY_MONTHS, true);
check('application redaction is 12 months', APPLICATION_REDACTION_MONTHS, 12);
check('consent retention is 5 years', CONSENT_RETENTION_MONTHS, 60);
check('access log retention is 24 months', ACCESS_LOG_RETENTION_MONTHS, 24);

console.log('');

// Plain cases.
check(
  '24 months before 2026-08-09',
  iso(monthsAgo(24, new Date('2026-08-09T12:00:00.000Z'))),
  '2024-08-09T12:00:00.000Z',
);
check(
  '12 months before 2026-01-15',
  iso(monthsAgo(12, new Date('2026-01-15T00:00:00.000Z'))),
  '2025-01-15T00:00:00.000Z',
);
check(
  '60 months before 2026-08-09',
  iso(monthsAgo(60, new Date('2026-08-09T12:00:00.000Z'))),
  '2021-08-09T12:00:00.000Z',
);

// Day-of-month overflow. Naive setMonth() turns 31 March minus 1 month into
// 3 March, which would purge data 28 days early.
check(
  '1 month before 31 March lands in February, not March',
  iso(monthsAgo(1, new Date('2026-03-31T00:00:00.000Z'))),
  '2026-02-28T00:00:00.000Z',
);
check(
  '12 months before 29 February 2028 clamps to 28 February 2027',
  iso(monthsAgo(12, new Date('2028-02-29T00:00:00.000Z'))),
  '2027-02-28T00:00:00.000Z',
);
check(
  '1 month before 31 May lands on 30 April',
  iso(monthsAgo(1, new Date('2026-05-31T00:00:00.000Z'))),
  '2026-04-30T00:00:00.000Z',
);

// Leap day survives when the target month has one.
check(
  '48 months before 29 February 2028 is 29 February 2024',
  iso(monthsAgo(48, new Date('2028-02-29T00:00:00.000Z'))),
  '2024-02-29T00:00:00.000Z',
);

// A cutoff must never land in the future, whatever the month lengths do.
const now = new Date('2026-08-09T12:00:00.000Z');
for (const months of [1, 11, 12, 23, 24, 60]) {
  check(`${months}-month cutoff is in the past`, monthsAgo(months, now) < now, true);
}

// Monotonic: a longer retention period must always produce an older cutoff, or
// "5 years" could sweep something "24 months" would have spared.
check(
  'consent cutoff is older than the candidate cutoff',
  monthsAgo(CONSENT_RETENTION_MONTHS, now) < monthsAgo(CANDIDATE_INACTIVITY_MONTHS, now),
  true,
);
check(
  'candidate cutoff is older than the warning cutoff',
  monthsAgo(CANDIDATE_INACTIVITY_MONTHS, now) < monthsAgo(CANDIDATE_WARNING_MONTHS, now),
  true,
);

// The input must not be mutated: db-purge.ts computes five cutoffs from one
// `now`, and an in-place edit would make each one relative to the last.
const original = new Date('2026-08-09T12:00:00.000Z');
monthsAgo(24, original);
check('monthsAgo does not mutate its input', iso(original), '2026-08-09T12:00:00.000Z');

// ---------------------------------------------------------------------------
// Every table with a stated retention period is actually swept.
// ---------------------------------------------------------------------------
// A retention period that exists only in a comment is the failure this checks
// for: the query can be written and the purge script never call it, and the
// only symptom is rows quietly living forever. Source-level, because the
// alternative needs a database.
{
  const purgeSource = readFileSync(join(process.cwd(), 'scripts/db-purge.ts'), 'utf8');
  const swept = [
    ['candidates', 'findCandidatesInactiveSince'],
    ['applications', 'findApplicationsToRedact'],
    ['consents', 'findConsentsToDelete'],
    ['data_access_logs', 'findAccessLogsToDelete'],
    ['auth_events', 'findAuthEventsToDelete'],
  ] as const;

  for (const [table, fn] of swept) {
    check(`${table} is swept by db-purge (${fn})`, purgeSource.includes(fn), true);
  }

  check(
    'auth_events deletions are actually executed, not only listed',
    purgeSource.includes('retention.deleteAuthEvents('),
    true,
  );
}

console.log('');
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('All retention cutoff assertions passed.');
process.exit(0);
