// The public read of the employer package prices (lib/plans.ts).
//
// Every page that shows a price or says "gratis" to an employer reads it from
// here — /planes, /publicar, the homepage band, EmployerBand, the employer
// dashboard's PlanCard — so the offer cannot say "free" on one page and
// "Gs. 149.000" on another. A price literal in page copy is the drift this
// module exists to prevent.
//
// `server-only`: the table is read with database credentials, and the admin
// form gets its initial values from its own server page.
import 'server-only';

import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import { cachedOrRaw } from './cached-or-raw';
import { DEFAULT_PLAN_PRICING, type PlanPricingTable } from './plans';

type SerializedRow = {
  key: keyof PlanPricingTable;
  priceGs: number;
  promoPriceGs: number | null;
  promoEndsAt: string | null;
};

/**
 * Defaults overlaid with whatever /admin/precios saved. Seed mode has no
 * database, so it gets the defaults — the same launch offer production starts
 * with before anyone has saved a price.
 */
export async function getPlanPricing(): Promise<PlanPricingTable> {
  const table: PlanPricingTable = { ...DEFAULT_PLAN_PRICING };
  if (process.env.DATA_SOURCE !== 'db') return table;
  for (const row of await readRows()) {
    table[row.key] = {
      key: row.key,
      priceGs: row.priceGs,
      promoPriceGs: row.promoPriceGs,
      promoEndsAt: row.promoEndsAt ? new Date(row.promoEndsAt) : null,
    };
  }
  return table;
}

/**
 * Serialized to ISO strings inside the cache: unstable_cache round-trips
 * through JSON, and a Date that comes back as a string would make every
 * `promoEndsAt.getTime()` throw. Own tag, invalidated by the one write that
 * moves it (lib/cache.ts invalidatePricing()).
 */
async function readRows(): Promise<SerializedRow[]> {
  const load = async (): Promise<SerializedRow[]> => {
    const { getPlanPriceRows } = await import('./db/plan-prices');
    return (await getPlanPriceRows()).map((row) => ({
      key: row.key,
      priceGs: row.priceGs,
      promoPriceGs: row.promoPriceGs,
      promoEndsAt: row.promoEndsAt?.toISOString() ?? null,
    }));
  };
  return cachedOrRaw(
    () =>
      unstable_cache(load, ['plan-pricing'], {
        revalidate: PUBLIC_CACHE_TTL_SECONDS,
        tags: [CACHE_TAGS.pricing],
      })(),
    load,
  );
}
