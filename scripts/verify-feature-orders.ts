// Asserts that a payment callback cannot be replayed into a second Destacado.
//
//   npm run orders:verify
//
// Why this is worth a script. A processor's confirmation callback is delivered
// at least once and often more: PagoPar retries until it gets the response it
// wants, a network hiccup duplicates a delivery, and anyone who captured a body
// can POST it again. The failure that follows a missing guard is silent and
// expensive in the direction that matters — the customer's window quietly
// doubles, nothing errors, no page looks different, and the only trace is a
// `featured_until` further out than anything was sold for.
//
// The guarantee is a property of ONE statement:
//
//   UPDATE feature_orders SET status='paid' WHERE id=? AND status='pending'
//
// MySQL evaluates the predicate and the write together, so of two simultaneous
// deliveries exactly one gets affectedRows === 1. A SELECT followed by an
// UPDATE has a window between them, and a retry lands in it.
//
// This script checks both halves of that:
//
//   1. Behaviour — PAID_CLAIM, the constant the real query builds its WHERE
//      clause from, is driven against a row through a generic simulation of
//      MySQL's conditional-UPDATE semantics. Called twice, sequentially or
//      interleaved, it may transition the row once.
//   2. Construction — lib/db/feature-orders.ts is read to confirm the real
//      query still applies that constant, still gates on affectedRows, and
//      still contains no check-then-write pair for a future edit to reach for.
//
// The second half exists because the first can only ever test what it is given:
// a correct constant applied by a query that forgot the WHERE clause would pass
// (1) and lose real money. Source-reading, for the same reason as
// scripts/verify-cascades.ts — the property is about what the file may contain.
//
// No database, no env, no network.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PAID_CLAIM,
  UNPAID_TERMINAL_STATUSES,
  type FeatureOrderStatus,
} from '../lib/db/feature-orders';
import { featureOrderStatusEnum } from '../lib/db/schema';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

// ---------------------------------------------------------------------------
// A row, and MySQL's conditional UPDATE.
//
// Deliberately generic: it applies whatever WHERE it is handed rather than
// knowing anything about payments, so the thing under test is PAID_CLAIM and
// not this simulation's opinion of it. `affectedRows` counts the rows the
// predicate matched, which for a SET that changes the status is what mysql2
// reports.
// ---------------------------------------------------------------------------

type OrderRow = {
  id: number;
  status: FeatureOrderStatus;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  featuredUntil: Date | null;
};

function pendingRow(id = 1): OrderRow {
  return { id, status: 'pending', paidAt: null, fulfilledAt: null, featuredUntil: null };
}

function conditionalUpdate(
  row: OrderRow,
  where: Partial<OrderRow>,
  set: Partial<OrderRow>,
): number {
  const matched = (Object.keys(where) as (keyof OrderRow)[]).every((key) => {
    const expected = where[key];
    const actual = row[key];
    return expected instanceof Date && actual instanceof Date
      ? expected.getTime() === actual.getTime()
      : actual === expected;
  });
  if (!matched) return 0;
  Object.assign(row, set);
  return 1;
}

/**
 * The claim, expressed exactly as lib/db/feature-orders.ts expresses it —
 * `id` and `status: PAID_CLAIM.from` in the WHERE, `status: PAID_CLAIM.to` in
 * the SET, and the caller fulfilling only on 1.
 */
function claimPaid(row: OrderRow, paidAt: Date): boolean {
  const affectedRows = conditionalUpdate(
    row,
    { id: row.id, status: PAID_CLAIM.from },
    { status: PAID_CLAIM.to, paidAt },
  );
  return affectedRows === 1;
}

const now = new Date('2026-08-30T12:00:00.000Z');
const later = new Date('2026-08-30T12:00:07.000Z');

// ---------------------------------------------------------------------------
// 1. The transition itself.
// ---------------------------------------------------------------------------

check(
  'the guard and the destination are different statuses',
  (PAID_CLAIM.from as string) !== (PAID_CLAIM.to as string),
  'A claim whose WHERE still matches after the SET is re-satisfiable, so every ' +
    'retry would claim again. This is the assumption every other case here rests on.',
);

check(
  'both ends of the claim are statuses the column can hold',
  (featureOrderStatusEnum as readonly string[]).includes(PAID_CLAIM.from) &&
    (featureOrderStatusEnum as readonly string[]).includes(PAID_CLAIM.to),
  'A status outside the enum makes the UPDATE fail at run time, on the delivery ' +
    'that carries the money.',
);

{
  const row = pendingRow();
  check('the first delivery claims a pending order', claimPaid(row, now) === true);
  check('the claimed order is paid', row.status === 'paid');
  check('paid_at records the delivery that claimed it', row.paidAt?.getTime() === now.getTime());
}

// ---------------------------------------------------------------------------
// 2. The retry. The whole point of the file.
// ---------------------------------------------------------------------------

{
  const row = pendingRow();
  const first = claimPaid(row, now);
  const second = claimPaid(row, later);

  check('a retried delivery does not claim again', first === true && second === false);
  check(
    'a retried delivery does not overwrite paid_at',
    row.paidAt?.getTime() === now.getTime(),
    'The second call must be a no-op in full, not a write that reports failure.',
  );
}

{
  // Ten deliveries of the same callback — PagoPar retrying, plus a replay.
  const row = pendingRow();
  const claims = Array.from({ length: 10 }, (_, i) =>
    claimPaid(row, new Date(now.getTime() + i * 1000)),
  ).filter(Boolean).length;

  check(
    'ten deliveries of one callback produce exactly one claim',
    claims === 1,
    `${claims} claims. Every claim beyond the first is a Destacado window granted ` +
      `for money nobody paid.`,
  );
}

{
  // Two deliveries in flight at once: both read the row as pending BEFORE
  // either writes. This is the interleaving a check-then-write loses to, and
  // the one the conditional UPDATE is chosen for.
  const row = pendingRow();
  const seenByA = row.status;
  const seenByB = row.status;

  const claimedByA = claimPaid(row, now);
  const claimedByB = claimPaid(row, later);

  check(
    'concurrent deliveries that both read `pending` still claim once',
    seenByA === 'pending' && seenByB === 'pending' && claimedByA !== claimedByB,
    'Both callers observed a pending order; only the one whose UPDATE matched may ' +
      'fulfil. A handler that branched on what it read would fulfil twice here.',
  );
}

// ---------------------------------------------------------------------------
// 3. Fulfilment hangs off the claim, and a settled order stays settled.
// ---------------------------------------------------------------------------

{
  const row = pendingRow();
  let windowsOpened = 0;

  for (const at of [now, later, new Date('2026-08-31T09:00:00.000Z')]) {
    if (claimPaid(row, at)) {
      windowsOpened += 1;
      row.fulfilledAt = at;
      row.featuredUntil = new Date(at.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  check(
    'three deliveries open exactly one window',
    windowsOpened === 1,
    'Fulfilment is gated on the claim, so the count of windows is the count of claims.',
  );
  check(
    'paid_at and fulfilled_at are recorded separately',
    row.paidAt !== null && row.fulfilledAt !== null,
    'An order with a paid_at and no fulfilled_at is money taken for a window never ' +
      'opened — the failure worth being able to find, and invisible if one column ' +
      'carried both facts (PLAN-PAGOPAR.md §3).',
  );
}

{
  // A late "expired" notice arriving after a successful payment.
  const row = pendingRow();
  claimPaid(row, now);
  const settled = conditionalUpdate(
    row,
    { id: row.id, status: PAID_CLAIM.from },
    { status: 'expired' },
  );

  check(
    'a late failure notice cannot walk a paid order backwards',
    settled === 0 && row.status === 'paid',
    'settleUnpaidFeatureOrder() claims from the same status, so a paid order is ' +
      'not reachable by it.',
  );
}

check(
  'no unpaid terminal status overlaps the claim',
  !UNPAID_TERMINAL_STATUSES.some(
    (s) => (s as string) === PAID_CLAIM.from || (s as string) === PAID_CLAIM.to,
  ) && UNPAID_TERMINAL_STATUSES.every((s) => (featureOrderStatusEnum as readonly string[]).includes(s)),
  'failed/expired/cancelled must be distinct from pending and paid, and all three ' +
    'must exist in the column.',
);

// ---------------------------------------------------------------------------
// 4. The real query still is the query above.
// ---------------------------------------------------------------------------

const MODULE = join(process.cwd(), 'lib/db/feature-orders.ts');
const source = readFileSync(MODULE, 'utf8');

/** The body of an exported function, from its signature to the next `\n}`. */
function bodyOf(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.indexOf('\n}');
  return end === -1 ? rest : rest.slice(0, end);
}

const claim = bodyOf('claimFeatureOrderPaid');

check('claimFeatureOrderPaid() exists', claim.length > 0, `Not found in ${MODULE}.`);

check(
  'the claim guards on the status it is claiming from',
  claim.includes('eq(featureOrders.status, PAID_CLAIM.from)'),
  'Without `AND status = \'pending\'` in the WHERE, the UPDATE matches a row that ' +
    'is already paid and every retry re-affects it.',
);

check(
  'the claim is scoped to one order id',
  claim.includes('eq(featureOrders.id, id)'),
  'A claim without the id in its WHERE claims whatever else is pending.',
);

check(
  'the claim reports the outcome from affectedRows',
  /affectedRows\s*===\s*1/.test(claim),
  'The row count IS the answer. Returning true unconditionally, or on >= 0, ' +
    'fulfils on every retry.',
);

check(
  'the claim does not read the row before writing it',
  !claim.includes('.select(') && !/status\s*===/.test(claim),
  'A SELECT followed by an UPDATE has a window between them, and a retried ' +
    'delivery lands in it. The write must be the check (PLAN-PAGOPAR.md §4 point 4).',
);

const settle = bodyOf('settleUnpaidFeatureOrder');

check(
  'settling an unpaid order is guarded the same way',
  settle.includes('eq(featureOrders.status, PAID_CLAIM.from)') &&
    /affectedRows\s*===\s*1/.test(settle),
  'An unguarded settle lets a late `expired` callback cancel an order that was paid.',
);

const create = bodyOf('createFeatureOrder');

check(
  'a new order is created pending, and the status is not a parameter',
  create.includes('status: PAID_CLAIM.from') && !/status:\s*input\./.test(create),
  'A status the caller can pass is a status the caller can pass as `paid`, which ' +
    'is the checkout paying for itself.',
);

const fulfil = bodyOf('recordFeatureOrderFulfilment');

check(
  'recording fulfilment does not also move the status',
  fulfil.length > 0 && !/status:/.test(fulfil),
  'The claim is what moves the status. A second write of it here would be a ' +
    'second, unguarded path to `paid`.',
);

check(
  'only PAID_CLAIM writes the paid status',
  !/status:\s*'paid'/.test(source),
  'A literal `status: \'paid\'` somewhere in this module is a transition that ' +
    'this script cannot see and the guard above does not cover.',
);

check(
  'every status-writing UPDATE carries a status guard',
  source
    .split('.update(featureOrders)')
    .slice(1)
    .map((segment) => segment.slice(0, segment.indexOf(';')))
    .every((statement) => !/status[:,]/.test(statement) || statement.includes('PAID_CLAIM.from')),
  'An UPDATE that sets `status` without `AND status = \'pending\'` is a second ' +
    'transition path with none of the properties tested above.',
);

// ---------------------------------------------------------------------------
// 5. The two rules this module inherits and may not relax.
// ---------------------------------------------------------------------------

check(
  'payment cannot publish: the module never touches `jobs`',
  !/\bjobs\b/.test(source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')),
  'A paid Destacado is still a job /admin approved. Fulfilment opens a window ' +
    'through computeFeaturedUntil() and the existing grant path, never by an ' +
    'UPDATE of `jobs` from here (PLAN-PAGOPAR.md §7).',
);

for (const fn of [
  'listCompanyFeatureOrders',
  'getCompanyFeatureOrder',
  'listCompanyJobFeatureOrders',
]) {
  const body = bodyOf(fn);
  check(
    `${fn}() takes companyId first and scopes on it`,
    new RegExp(`export async function ${fn}\\(\\s*companyId: number`).test(source) &&
      body.includes('eq(featureOrders.companyId, companyId)'),
    'lib/db/employer.ts\'s contract (AGENTS.md): companyId first, and in the WHERE ' +
      'clause rather than in a check the caller performs on the returned row.',
  );
}

// ---------------------------------------------------------------------------
// 6. payment_events is append-only, everywhere.
//
// It is the reconciliation trail and the evidence of deliveries we rejected, so
// it is registered as a DELIBERATE_ORPHAN in scripts/verify-cascades.ts rather
// than cleaned up with the order it names. That decision only holds if nothing
// deletes or rewrites these rows by another route.
// ---------------------------------------------------------------------------

{
  const dbDir = join(process.cwd(), 'lib/db');
  const offenders = readdirSync(dbDir)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => {
      const text = readFileSync(join(dbDir, f), 'utf8');
      return /\.delete\(paymentEvents\)/.test(text) || /\.update\(paymentEvents\)/.test(text);
    });

  check(
    'nothing in lib/db deletes or updates payment_events',
    offenders.length === 0,
    `${offenders.join(', ')} rewrites the delivery log. A callback delivery is ` +
      `evidence of what a processor sent us — editing or removing one is editing ` +
      `the record of a payment dispute, and it is what makes the ` +
      `DELIBERATE_ORPHAN entry in scripts/verify-cascades.ts true.`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll feature-order idempotency assertions passed.');
process.exit(0);
