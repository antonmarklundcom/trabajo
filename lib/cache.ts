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

// PUBLIC_CACHE_TTL_SECONDS and CACHE_TAGS live in ./cache-tags — that module
// has no server-only/next runtime imports, so lib/db/queries.ts (loaded by
// db:* scripts under plain tsx, not just Next) can depend on them without
// pulling in this file's Next-server-only invalidation logic. Re-exported
// here so existing Route Handler imports (`@/lib/cache`) are unaffected.
export { PUBLIC_CACHE_TTL_SECONDS, CACHE_TAGS } from './cache-tags';
import { CACHE_TAGS } from './cache-tags';

/**
 * Public routes whose rendered output is derived from job or company data.
 * Kept next to the tags so adding a public route means updating one list.
 * `npm run cachekey:verify` finds every page that reads jobs through
 * lib/data.ts and fails if its route is missing here.
 */
const PUBLIC_PATHS: ReadonlyArray<readonly [path: string, type?: 'page' | 'layout']> = [
  ['/'],
  ['/empleos'],
  ['/empleos/[slug]', 'page'],
  ['/trabajo/[categoria]', 'page'],
  ['/trabajo/[categoria]/[ciudad]', 'page'],
  // The city landing lists that city's jobs. It was missing here, so a job
  // approval or an expiry reached /trabajo/... at once but /trabajo-en/... only
  // on its 300s timer — two landings for the same city disagreeing.
  ['/trabajo-en/[ciudad]', 'page'],
  // An article lists related jobs ("Empleos relacionados"), so a job write
  // changes it too. Also in BLOG_PATHS, for article writes.
  ['/blog/[slug]', 'page'],
  // Company pages list the company's jobs AND show its profile, so both a job
  // write and a company write (admin edit, employer profile, logo) change them.
  ['/empresas/[slug]', 'page'],
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

/**
 * The launch promotion counter (lib/promo.ts, PLAN-GROWTH.md §4 Batch P).
 *
 * Called by the one write that can move it: the admin status transition that
 * grants a promo Destacado. No path entry — the counter is read inside pages
 * that invalidatePublicContent() already covers (/planes, /publicar) and in
 * /admin, which is never cached.
 */
export function invalidateLaunchPromo(): void {
  revalidateTag(CACHE_TAGS.promo, { expire: 0 });
}

/**
 * The package prices (lib/pricing.ts), after /admin/precios saves. The whole
 * site, not a list of paths: the root layout renders PromoTopBar from the
 * price table, so every page embeds it. A price change is a rare admin action;
 * re-rendering everything on demand is the price of never leaving a stale
 * offer on a page nobody thought to list.
 */
export function invalidatePricing(): void {
  revalidateTag(CACHE_TAGS.pricing, { expire: 0 });
  revalidatePath('/', 'layout');
}

/**
 * Routes whose rendered output embeds blog posts. Kept apart from
 * PUBLIC_PATHS because the two lists answer different writes: an article edit
 * cannot change a job listing. Since C2 the blog's linking surfaces put posts
 * on job and landing pages too, so several routes now appear in both lists —
 * a page derived from both kinds of content is refreshed by either write.
 * `npm run blog:verify` finds every public page that imports a read from
 * lib/blog.ts and fails if its route is missing here.
 */
const BLOG_PATHS: ReadonlyArray<readonly [path: string, type?: 'page' | 'layout']> = [
  ['/blog'],
  ['/blog/[slug]', 'page'],
  ['/blog/categoria/[categoria]', 'page'],
  // Linking surfaces (PLAN-GROWTH.md §4 C2).
  ['/'],
  ['/empleos/[slug]', 'page'],
  ['/trabajo/[categoria]', 'page'],
  ['/trabajo/[categoria]/[ciudad]', 'page'],
  ['/publicar'],
  ['/planes'],
  ['/sitemap.xml'],
];

/**
 * Call from a Route Handler after ANY blog mutation — create, edit, publish,
 * unpublish, delete, cover upload or removal.
 *
 * Invalidating on a draft's edit too, unconditionally: `status` is caller-
 * supplied, an edit can flip it either way, and expiring a cache entry for a
 * post nobody can see costs one query nobody will run.
 */
export function invalidateBlogContent(): void {
  revalidateTag(CACHE_TAGS.blog, { expire: 0 });

  for (const [path, type] of BLOG_PATHS) {
    revalidatePath(path, type);
  }
}
