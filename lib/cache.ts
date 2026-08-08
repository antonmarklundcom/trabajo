// Cache tags and the single invalidation entry point for public content.
//
// Written against node_modules/next/dist/docs (Next 16). What actually changed
// versus older material, and why this file looks the way it does:
//
//   - Next 16 ships TWO caching models. `use cache` / `cacheTag` / `cacheLife`
//     only exist when `cacheComponents: true` is set in next.config.ts
//     (03-api-reference/01-directives/use-cache.md, "Usage"). This repo does
//     not set it, so the "previous model" documented in
//     02-guides/caching-without-cache-components.md applies:
//     `unstable_cache` + `revalidateTag` + `revalidatePath`. Turning
//     Cache Components on is a whole-app migration (PPR, Suspense boundaries
//     around every runtime-API read) and next.config.ts is outside this step's
//     scope — on a repo where merging to `main` is a production deploy with no
//     staging, that is not a change to smuggle into a caching PR.
//
//   - `unstable_cache` is marked "replaced by `use cache`" in Next 16 but is
//     still exported from `next/cache` and still functional. It is the only
//     data-cache primitive available without Cache Components.
//
//   - `revalidateTag` now takes a MANDATORY second argument
//     (04-functions/revalidateTag.md). The old one-argument form is deprecated.
//     The two documented behaviours differ in a way that matters here:
//       * `revalidateTag(tag, 'max')` → stale-while-revalidate. The next
//         visitor is served the STALE entry while a fresh one builds. That is
//         wrong for us: an editor who publishes a job must see it live
//         immediately, and a rejected or archived job must stop being served
//         immediately.
//       * `revalidateTag(tag, { expire: 0 })` → immediate expiry. The doc
//         names this as the pattern for callers that "require data to expire
//         immediately" and cannot use `updateTag`.
//
//   - `updateTag` would be the idiomatic read-your-own-writes call, but it is
//     Server-Actions-only (04-functions/updateTag.md). Every admin mutation in
//     this app is a Route Handler under app/api/admin/*, so `{ expire: 0 }` is
//     the correct tool.
import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Time-based safety net for the cached read path.
 *
 * Admin writes invalidate on demand (below), so this timer is NOT what keeps
 * the site fresh after an edit. It exists for the two state transitions that
 * happen with no write to hook onto, because both are query predicates rather
 * than stored flags (ARCHITECTURE.md §6):
 *
 *   - a job passing `expires_at` and disappearing from public listings,
 *   - `featured_until` lapsing and the job dropping out of the featured block.
 *
 * Five minutes bounds that drift while cutting worst-case DB traffic per cache
 * key by 10x versus the 30s/60s route timers this replaces — which is the
 * point, given `connectionLimit: 8` on the pool (ARCHITECTURE.md §8).
 */
export const PUBLIC_CACHE_TTL_SECONDS = 300;

/**
 * Two tags, deliberately coarse.
 *
 * A finer scheme (per-slug, per-category) buys nothing: any job write can move
 * a job in or out of every list, every taxonomy count and the sitemap at once,
 * so a correct fine-grained invalidation would have to fire most of the tags
 * anyway. The failure mode of over-invalidating is a few extra queries; the
 * failure mode of under-invalidating is serving an unapproved or deleted
 * listing. Those costs are not symmetric.
 */
export const CACHE_TAGS = {
  /** Every public job read: lists, detail, featured, recent. */
  jobs: 'public-jobs',
  /** Categories and cities, including their published-job counts. */
  taxonomies: 'public-taxonomies',
} as const;

/**
 * Public routes whose rendered output is derived from job or company data.
 * Kept next to the tags so adding a public route means updating one list.
 */
const PUBLIC_PATHS: ReadonlyArray<readonly [path: string, type?: 'page' | 'layout']> = [
  ['/'],
  ['/empleos'],
  ['/empleos/[slug]', 'page'],
  ['/trabajo/[categoria]', 'page'],
  ['/trabajo/[categoria]/[ciudad]', 'page'],
  ['/sitemap.xml'],
];

/**
 * Call from a Route Handler after ANY mutation that can change what the public
 * site shows — creating, editing, publishing, unpublishing or deleting a job,
 * and editing a company (its name and logo are denormalised onto every job
 * card through the join in lib/db/queries.ts).
 *
 * Tags and paths are both invalidated on purpose. They cover different things
 * and the docs describe them as complementary (04-functions/revalidatePath.md,
 * "Relationship with revalidateTag and updateTag"): tags expire the cached
 * query results wherever they are used, paths cover the rendered route
 * entries. Neither triggers work on its own — invalidation only marks entries;
 * the query re-runs when a visitor next asks for the page.
 *
 * Not called from the users routes: users are never read by the public site.
 */
export function invalidatePublicContent(): void {
  revalidateTag(CACHE_TAGS.jobs, { expire: 0 });
  revalidateTag(CACHE_TAGS.taxonomies, { expire: 0 });

  for (const [path, type] of PUBLIC_PATHS) {
    revalidatePath(path, type);
  }
}
