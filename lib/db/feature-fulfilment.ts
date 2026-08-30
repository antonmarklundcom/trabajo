// Turning a paid order into an open Destacado window (PLAN-PAGOPAR.md §4).
//
// ===========================================================================
// WHAT THIS FILE IS, AND WHY IT EXISTS BEFORE THE WEBHOOK DOES
//
// This is the half of the checkout that has nothing to do with PagoPar. §10
// says the fulfilment path is processor-independent — a Bancard adapter is a
// new module and a second route with this path untouched — and everything §4
// points 4, 5, 6 and 8 require lives here rather than in a route handler:
//
//   4. The claim is a conditional UPDATE whose affectedRows is the check
//      (claimFeatureOrderPaid, PR A). Nothing is granted unless the claim won.
//   5. The window is computed by computeFeaturedUntil() and written by
//      applyFeatureGrant() — the same code the manual WhatsApp sale goes
//      through. There is no second UPDATE of `jobs` anywhere.
//   6. The grant is logged to activity_log with channel 'pagopar' and a NULL
//      actor, mirroring the manual sale's meta so both channels reconcile from
//      one query.
//   8. `days` and `amountGs` are read from OUR feature_orders row. This
//      function takes an order id and nothing else — there is no parameter a
//      callback body could reach, which is what makes "a callback that names
//      the number of days buys a year for one guaraní" unwritable rather than
//      merely guarded against.
//
// What is NOT here, deliberately: the adapter, the signature verification and
// the route. Those need PagoPar's live documentation — the payment-request
// shape, the exact token scheme, the callback contract — and §2 says to stop
// and ask rather than infer any of them. A verification routine written from
// memory is an endpoint that verifies nothing while looking like it does, so
// the route arrives in the PR that has the documentation open.
//
// Nothing calls this yet. It cannot fulfil anything until something creates a
// feature_orders row, and nothing does.
// ===========================================================================
import 'server-only';

import { applyFeatureGrant } from './admin';
import {
  claimFeatureOrderPaid,
  getFeatureOrderById,
  recordFeatureOrderFulfilment,
} from './feature-orders';
import { isFeatureDuration } from '../featured';

export type FulfilmentResult =
  | { ok: true; orderId: number; jobId: number; featuredUntil: Date }
  | {
      ok: false;
      reason:
        | /** No such order. A delivery naming an id we never issued. */
        'not_found'
        | /** Someone already claimed it — a retry, or two deliveries at once. */
          'already_settled'
        | /** Claimed, but the job it was bought for is gone. */
          'job_missing'
        | /** Claimed, but the row's `days` is not a duration we sell. */
          'unsellable_duration';
    };

/**
 * Fulfils a paid order, exactly once.
 *
 * The order of operations is the whole design, and each step is what makes the
 * next one safe:
 *
 *   1. Read our own order row. Everything the grant needs comes from here.
 *   2. Claim it — `WHERE id = ? AND status = 'pending'`. A retried or replayed
 *      delivery loses the race and returns `already_settled` having written
 *      nothing.
 *   3. Grant, through the shared path, so the window arithmetic has one
 *      implementation.
 *   4. Record what the grant produced, so `paid_at` and `fulfilled_at` are two
 *      separately visible facts.
 *
 * Payment buys placement, never publication (PLAN-PAGOPAR.md §7). Nothing here
 * reads or writes `jobs.status`: a paid Destacado on a `pending` listing stays
 * invisible until /admin approves it, and that is correct — the customer bought
 * a position in a list, not a way past moderation.
 */
export async function fulfilFeatureOrder(
  orderId: number,
  paidAt: Date,
): Promise<FulfilmentResult> {
  const order = await getFeatureOrderById(orderId);
  if (!order) return { ok: false, reason: 'not_found' };

  // The closed list from lib/featured.ts, checked against OUR row rather than
  // against anything a caller passed. A row holding a duration nobody sells
  // means the order was written by something that bypassed createFeatureOrder's
  // caller — so it is refused before the claim, leaving the order pending for a
  // human to look at rather than silently granting a window nobody priced.
  if (!isFeatureDuration(order.days)) return { ok: false, reason: 'unsellable_duration' };

  // The claim. Everything below runs at most once per order, for all time.
  const claimed = await claimFeatureOrderPaid(order.id, paidAt);
  if (!claimed) return { ok: false, reason: 'already_settled' };

  // `extend: true` — a Destacado bought while one is still running must ADD to
  // the open window, never restart it. computeFeaturedUntil() handles the
  // lapsed case too, so a renewal on a listing that went cold last month starts
  // from now instead of back-dating into the past (npm run featured:verify).
  const grant = await applyFeatureGrant(order.jobId, null, {
    days: order.days,
    extend: true,
    amountGs: order.amountGs,
    // The manual sale's method values (transferencia, efectivo, giro) describe
    // how cash reached us in a conversation. A processor payment has no such
    // field; `channel` is what says how it arrived.
    method: null,
    note: null,
    channel: 'pagopar',
    orderId: order.id,
  });

  // The order is claimed and the job is gone. `fulfilled_at` deliberately stays
  // NULL: an order with a `paid_at` and no `fulfilled_at` is money taken for a
  // window never opened, which is exactly the state PR A split the two columns
  // to make findable. Overwriting it with a fulfilment that did not happen
  // would hide the only evidence.
  if (!grant) return { ok: false, reason: 'job_missing' };

  await recordFeatureOrderFulfilment(order.id, new Date(), grant.featuredUntil);

  return {
    ok: true,
    orderId: order.id,
    jobId: order.jobId,
    featuredUntil: grant.featuredUntil,
  };
}
