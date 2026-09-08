// The launch promotion: the first 100 approved listings get Destacado for 90
// days, free (PLAN-GROWTH.md §4 Batch P, §7 D15).
//
// What this module is NOT: a second way to become featured. The promotion
// rides entirely on the existing `featured_until` machinery — the window is
// still computed by computeFeaturedUntil(), the grant is still written by
// applyFeatureGrant(), and the only thing new is a third channel value plus
// the quota below. PLAN-PAGOPAR.md §1 is the contract that keeps.
//
// And it is NOT a way to publish. A promo grant happens INSIDE the admin
// status transition to `published`, after a human has approved the listing —
// never on create, never on the employer path, never on /api/publicar. The
// promotion rewards a listing that already passed moderation; it cannot be
// what moves one through it.
//
// `server-only` because the flag is read from a non-public env var: a
// client-visible flag is a hint to the browser, not a gate (lib/flags.ts).
import 'server-only';

import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from './cache-tags';
import { cachedOrRaw } from './cached-or-raw';
import { LAUNCH_PROMO } from './featured';

// The offer itself (quota and days) lives in lib/featured.ts, next to the rest
// of the Destacado product: the admin client components render the quota and
// cannot import a `server-only` module. The owner ends the promotion with the
// flag below or by letting the quota run out — never by editing the number,
// because a quota that can be raised in hPanel is a quota the /terminos clause
// no longer describes.

/**
 * Exact-`"true"`, the same rule every flag in lib/flags.ts follows: an unset
 * variable must never mean "on", so forgetting to configure the promotion and
 * choosing to run it stay distinguishable. Ending it early is therefore a
 * dated hPanel decision rather than a deploy.
 */
export function launchPromoEnabled(): boolean {
  return process.env.LAUNCH_PROMO_ENABLED?.trim().toLowerCase() === 'true';
}

export type LaunchPromoStatus = {
  enabled: boolean;
  quota: number;
  granted: number;
  remaining: number;
};

/**
 * What every promo surface reads. `remaining` is clamped at 0 so a surface can
 * render on `remaining > 0` alone and no caller has to remember the quota.
 *
 * `granted` counts `feature_grant` rows whose channel is `promo_launch` — one
 * per job, because the grant path refuses a second promo grant on a job id it
 * already granted one for. That makes "how many promo grants" the same
 * activity_log query as "how many sales", which is the whole reason the
 * promotion is a channel rather than a table.
 *
 * Seed mode has no activity_log at all, so `granted` is 0 there: the public
 * copy renders as "100 left" on a seed deploy, which is what a site with no
 * database has in fact granted.
 */
export async function getLaunchPromoStatus(): Promise<LaunchPromoStatus> {
  const enabled = launchPromoEnabled();
  const granted = enabled ? await countGranted() : 0;
  return {
    enabled,
    quota: LAUNCH_PROMO.quota,
    granted,
    remaining: Math.max(0, LAUNCH_PROMO.quota - granted),
  };
}

/**
 * Cached under its own tag rather than CACHE_TAGS.jobs: the counter changes on
 * exactly one write (a promo grant) and a job edit must not expire it, nor it
 * a job list. lib/cache.ts's invalidateLaunchPromo() is called by the grant.
 */
async function countGranted(): Promise<number> {
  if (process.env.DATA_SOURCE !== 'db') return 0;
  const { countLaunchPromoGrants } = await import('./db/admin');
  return cachedOrRaw(
    () =>
      unstable_cache(() => countLaunchPromoGrants(), ['launch-promo-granted'], {
        revalidate: PUBLIC_CACHE_TTL_SECONDS,
        tags: [CACHE_TAGS.promo],
      })(),
    () => countLaunchPromoGrants(),
  );
}
