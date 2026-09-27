// Reads and writes `plan_prices` (lib/plans.ts, /admin/precios).
//
// The public read is lib/pricing.ts, which caches this and falls back to
// DEFAULT_PLAN_PRICING; nothing public imports this module directly. The write
// is admin-only and is checked in the route handler, not here, the same split
// every other admin mutation in this repo uses.
//
// `db` is imported lazily, exactly as in lib/db/admin.ts: lib/db/index.ts opens
// its pool at module evaluation, and this module must be importable when
// DATA_SOURCE=seed and DATABASE_URL is unset.
import 'server-only';

import { activityLog, planPrices } from './schema';
import { isPlanKey, type PlanPricing } from '../plans';

async function getDb() {
  return (await import('./index')).db;
}

/** Every saved row. A package with no row uses its default (lib/plans.ts). */
export async function getPlanPriceRows(): Promise<PlanPricing[]> {
  const db = await getDb();
  const rows = await db.select().from(planPrices);
  return rows
    .filter((row) => isPlanKey(row.planKey))
    .map((row) => ({
      key: row.planKey as PlanPricing['key'],
      priceGs: row.priceGs,
      promoPriceGs: row.promoPriceGs,
      promoEndsAt: row.promoEndsAt,
    }));
}

/**
 * Saves all packages at once, in one transaction, and records who changed
 * what in activity_log. The caller has already validated every row with
 * validatePlanPricing() and checked the session's role.
 */
export async function savePlanPrices(actorUserId: number, plans: PlanPricing[]): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const plan of plans) {
      const values = {
        priceGs: plan.priceGs,
        promoPriceGs: plan.promoPriceGs,
        promoEndsAt: plan.promoEndsAt,
        updatedAt: now,
      };
      await tx
        .insert(planPrices)
        .values({ planKey: plan.key, ...values })
        .onDuplicateKeyUpdate({ set: values });
    }
    await tx.insert(activityLog).values({
      actorUserId,
      entityType: 'plan_prices',
      entityId: 0,
      action: 'pricing_update',
      meta: plans.map((plan) => ({
        key: plan.key,
        priceGs: plan.priceGs,
        promoPriceGs: plan.promoPriceGs,
        promoEndsAt: plan.promoEndsAt?.toISOString() ?? null,
      })),
      createdAt: now,
    });
  });
}
