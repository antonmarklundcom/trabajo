// The self-serve Destacado order book (PLAN-PAGOPAR.md §3, §4).
//
// ===========================================================================
// WHAT THIS FILE IS FOR
//
// A payment processor's confirmation callback is delivered at least once, and
// in practice more than once: PagoPar retries until it gets the response it
// wants, a network hiccup produces a duplicate, and a curious visitor can
// replay a body they captured. Every one of those must open the paid window
// exactly once. The mechanism for that is claimFeatureOrderPaid() below —
// the write IS the check, never a SELECT followed by an UPDATE.
//
// Nothing calls this module yet. The webhook that will (PR B) is deliberately
// a separate PR, so that the migration these functions read and write runs
// against production as its own reviewable event — this repo has no staging
// environment to rehearse it in (PLAN-PAGOPAR.md §8).
//
// Two rules this file inherits and does not get to relax:
//
//   - Payment never publishes. Nothing here touches `jobs.status`, and
//     fulfilment (PR B) goes through computeFeaturedUntil() and the existing
//     grant path rather than a second UPDATE of `jobs` (PLAN-PAGOPAR.md §7).
//   - Employer-facing reads take `companyId` FIRST and mention it in their
//     WHERE clause, exactly as lib/db/employer.ts requires of itself
//     (AGENTS.md). There is no admin-bypass argument on those functions; the
//     unscoped lookups below are the webhook's, which has no session at all
//     and identifies an order by the processor's reference.
// ===========================================================================
//
// `db` is imported lazily, exactly as in lib/db/admin.ts and
// lib/db/employer.ts: lib/db/index.ts opens its pool at module evaluation, and
// this module must be importable when DATA_SOURCE=seed and DATABASE_URL is
// unset.
import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import {
  featureOrders,
  paymentEvents,
  type featureOrderStatusEnum,
  type paymentProcessorEnum,
} from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type FeatureOrderStatus = (typeof featureOrderStatusEnum)[number];
export type PaymentProcessor = (typeof paymentProcessorEnum)[number];

/**
 * The one transition a payment callback is allowed to cause, as data.
 *
 * `from` is not decoration: it is the second half of the UPDATE's WHERE clause
 * in claimFeatureOrderPaid(), and it is what makes a retried delivery affect
 * zero rows instead of a second window. scripts/verify-feature-orders.ts drives
 * this constant against a simulated row to prove that a double call can only
 * claim once, and reads this file to prove the real query still applies it.
 *
 * Every other status (`failed`, `expired`, `cancelled`) is set by
 * settleUnpaidFeatureOrder(), which claims from `pending` under the same rule
 * — so an order that was already paid can never be walked backwards by a late
 * failure notice.
 */
export const PAID_CLAIM = { from: 'pending', to: 'paid' } as const;

/** The statuses an order that never got paid may end in. */
export const UNPAID_TERMINAL_STATUSES = ['failed', 'expired', 'cancelled'] as const;
export type UnpaidTerminalStatus = (typeof UNPAID_TERMINAL_STATUSES)[number];

export type FeatureOrder = {
  id: number;
  jobId: number;
  companyId: number;
  days: number;
  amountGs: number;
  status: FeatureOrderStatus;
  processor: PaymentProcessor;
  processorOrderId: string;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  featuredUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const orderColumns = {
  id: featureOrders.id,
  jobId: featureOrders.jobId,
  companyId: featureOrders.companyId,
  days: featureOrders.days,
  amountGs: featureOrders.amountGs,
  status: featureOrders.status,
  processor: featureOrders.processor,
  processorOrderId: featureOrders.processorOrderId,
  paidAt: featureOrders.paidAt,
  fulfilledAt: featureOrders.fulfilledAt,
  featuredUntil: featureOrders.featuredUntil,
  createdAt: featureOrders.createdAt,
  updatedAt: featureOrders.updatedAt,
};

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export type NewFeatureOrder = {
  jobId: number;
  companyId: number;
  days: number;
  amountGs: number;
  processor: PaymentProcessor;
  /** The processor's reference for this order. UNIQUE in the schema. */
  processorOrderId: string;
};

/**
 * Records an order as `pending`.
 *
 * The status is hardcoded rather than accepted from the caller, for the same
 * reason createEmployerJob() hardcodes `pending`: a status that can be passed
 * in is a status that can be passed in as `paid`. The only way out of
 * `pending` is a claim below.
 *
 * `days` and `amountGs` are the record of what was bought, and PR B's webhook
 * reads them from here rather than from the callback body — see
 * PLAN-PAGOPAR.md §4 point 8.
 */
export async function createFeatureOrder(input: NewFeatureOrder): Promise<number> {
  const db = await getDb();
  const now = new Date();

  const [result] = await db.insert(featureOrders).values({
    jobId: input.jobId,
    companyId: input.companyId,
    days: input.days,
    amountGs: input.amountGs,
    status: PAID_CLAIM.from,
    processor: input.processor,
    processorOrderId: input.processorOrderId,
    createdAt: now,
    updatedAt: now,
  });

  return result.insertId;
}

// ---------------------------------------------------------------------------
// Lookup
//
// These two are unscoped on purpose: their caller is the webhook, a
// server-to-server POST with no session and no company to scope by. It takes
// the order's identity from the processor's reference and nothing from a
// cookie (PLAN-PAGOPAR.md §4 point 7). Everything an employer can reach is in
// the companyId-first section below.
// ---------------------------------------------------------------------------

export async function getFeatureOrderByProcessorOrderId(
  processor: PaymentProcessor,
  processorOrderId: string,
): Promise<FeatureOrder | null> {
  if (!processorOrderId) return null;

  const db = await getDb();
  const [row] = await db
    .select(orderColumns)
    .from(featureOrders)
    .where(
      and(
        eq(featureOrders.processor, processor),
        eq(featureOrders.processorOrderId, processorOrderId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getFeatureOrderById(id: number): Promise<FeatureOrder | null> {
  const db = await getDb();
  const [row] = await db
    .select(orderColumns)
    .from(featureOrders)
    .where(eq(featureOrders.id, id))
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------
// The idempotency primitive (PLAN-PAGOPAR.md §4 point 4)
// ---------------------------------------------------------------------------

/**
 * Claims an order for fulfilment, or reports that someone already did.
 *
 * `WHERE id = ? AND status = 'pending'` is the whole guarantee. MySQL applies
 * the predicate and the write in one statement, so of two callbacks that
 * arrive at the same instant exactly one gets `affectedRows === 1` and the
 * other gets 0 — no transaction, no lock, and no window between a check and a
 * write for the second delivery to slip through. The same shape
 * redeemUserToken() and acceptInvitation() already use.
 *
 * The caller fulfils ONLY when this returns true. Reading the row first and
 * branching on `row.status === 'pending'` would extend a paid window twice
 * under a retry, which is the exact bug this file exists to make unwritable.
 */
export async function claimFeatureOrderPaid(id: number, paidAt: Date): Promise<boolean> {
  const db = await getDb();

  const [result] = await db
    .update(featureOrders)
    .set({ status: PAID_CLAIM.to, paidAt, updatedAt: new Date() })
    .where(and(eq(featureOrders.id, id), eq(featureOrders.status, PAID_CLAIM.from)));

  return result.affectedRows === 1;
}

/**
 * Records what the claim produced: when the window was opened and where it
 * now ends.
 *
 * Separate from the claim, and written after the grant, because `paid_at` and
 * `fulfilled_at` are two different facts (PLAN-PAGOPAR.md §3). An order with a
 * `paid_at` and no `fulfilled_at` is money we took and a window we did not
 * open — the failure worth being able to find, and invisible if one column
 * carried both.
 *
 * `featured_until` is a copy of the window this order produced, not a live
 * pointer: a later manual grant or revoke (PLAN-PAGOPAR.md §6) changes the
 * job, and must not rewrite what this order delivered.
 */
export async function recordFeatureOrderFulfilment(
  id: number,
  fulfilledAt: Date,
  featuredUntil: Date,
): Promise<void> {
  const db = await getDb();

  await db
    .update(featureOrders)
    .set({ fulfilledAt, featuredUntil, updatedAt: new Date() })
    .where(eq(featureOrders.id, id));
}

/**
 * Settles an order that will never be paid — a failed payment, an expired
 * checkout, a cancelled one.
 *
 * Claims from `pending` under the same rule as the paid transition, so a late
 * "expired" notice arriving after a successful payment cannot walk a paid
 * order backwards and cannot un-fulfil a window the customer already has.
 * Returns false when there was nothing pending to settle.
 */
export async function settleUnpaidFeatureOrder(
  id: number,
  status: UnpaidTerminalStatus,
): Promise<boolean> {
  const db = await getDb();

  const [result] = await db
    .update(featureOrders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(featureOrders.id, id), eq(featureOrders.status, PAID_CLAIM.from)));

  return result.affectedRows === 1;
}

// ---------------------------------------------------------------------------
// Employer-scoped reads — companyId FIRST, in the WHERE clause, no exceptions
//
// The UI that calls these is PR C. They are written under lib/db/employer.ts's
// contract now rather than later because the contract is what makes the
// question "can this read another company's orders?" answerable by reading the
// function — and a function written without it does not acquire it by being
// moved.
// ---------------------------------------------------------------------------

/** An employer's own order history for /empresa, newest first. */
export async function listCompanyFeatureOrders(
  companyId: number,
  limit = 50,
): Promise<FeatureOrder[]> {
  const db = await getDb();

  return db
    .select(orderColumns)
    .from(featureOrders)
    .where(eq(featureOrders.companyId, companyId))
    .orderBy(desc(featureOrders.createdAt), desc(featureOrders.id))
    .limit(limit);
}

/**
 * One of this company's orders, or null.
 *
 * Ownership is in the WHERE clause rather than in a check the caller performs
 * on the returned row: a scoped read cannot be reached by a handler that
 * forgot the check, and it returns the same null for "does not exist" and
 * "belongs to someone else".
 */
export async function getCompanyFeatureOrder(
  companyId: number,
  orderId: number,
): Promise<FeatureOrder | null> {
  const db = await getDb();

  const [row] = await db
    .select(orderColumns)
    .from(featureOrders)
    .where(and(eq(featureOrders.companyId, companyId), eq(featureOrders.id, orderId)))
    .limit(1);

  return row ?? null;
}

/** The orders raised against one of this company's listings, newest first. */
export async function listCompanyJobFeatureOrders(
  companyId: number,
  jobId: number,
): Promise<FeatureOrder[]> {
  const db = await getDb();

  return db
    .select(orderColumns)
    .from(featureOrders)
    .where(and(eq(featureOrders.companyId, companyId), eq(featureOrders.jobId, jobId)))
    .orderBy(desc(featureOrders.createdAt), desc(featureOrders.id));
}

// ---------------------------------------------------------------------------
// The delivery log
// ---------------------------------------------------------------------------

export type NewPaymentEvent = {
  /**
   * Null whenever the delivery cannot be tied to an order: an unparseable
   * body, a reference we never issued, a callback for an order since deleted.
   * Those are the deliveries most worth keeping.
   */
  orderId: number | null;
  processor: PaymentProcessor;
  /**
   * Recorded, never consulted as permission. PR B writes the row BEFORE it
   * verifies anything, so a `false` here is the evidence that a forged or
   * malformed delivery arrived — which only exists if the write does not wait
   * for the verification to pass (PLAN-PAGOPAR.md §4 point 2).
   */
  signatureValid: boolean;
  /** The body as it arrived. */
  payload: unknown;
  ip: string | null;
};

/**
 * Appends one callback delivery to the reconciliation trail.
 *
 * Append-only by construction: there is no update and no delete for this table
 * anywhere in lib/db, which is what scripts/verify-feature-orders.ts asserts
 * and what makes these rows outlive the orders they describe
 * (scripts/verify-cascades.ts, DELIBERATE_ORPHANS).
 */
export async function recordPaymentEvent(input: NewPaymentEvent): Promise<number> {
  const db = await getDb();

  const [result] = await db.insert(paymentEvents).values({
    orderId: input.orderId,
    processor: input.processor,
    signatureValid: input.signatureValid,
    payload: input.payload,
    // Truncated rather than rejected: an address we cannot store in 45
    // characters must not cost us the evidence row.
    ip: input.ip ? input.ip.slice(0, 45) : null,
    receivedAt: new Date(),
  });

  return result.insertId;
}

export type PaymentEventRow = typeof paymentEvents.$inferSelect;
