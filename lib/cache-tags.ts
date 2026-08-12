// Pure cache constants, split out of lib/cache.ts.
//
// lib/cache.ts imports `server-only` and `next/cache`, both of which throw or
// no-op outside a Next.js server request context. lib/db/queries.ts needs
// only the tag/TTL values below, and it is also imported by db:* scripts
// (scripts/parity-check.ts via lib/data.ts) that run under plain tsx, not
// Next. Keeping these values in a side-effect-free module lets that read path
// work under both runtimes; lib/cache.ts re-exports them so existing imports
// from Route Handlers are unaffected.

/**
 * Time-based safety net for the cached read path.
 *
 * Admin writes invalidate on demand (lib/cache.ts), so this timer is NOT what
 * keeps the site fresh after an edit. It exists for the two state transitions
 * that happen with no write to hook onto, because both are query predicates
 * rather than stored flags (ARCHITECTURE.md §6):
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
  /**
   * Every public blog read: the list, an article, and the retired-slug
   * redirects. Separate from `jobs` because the two invalidate on completely
   * different writes — publishing an article must not expire every job list,
   * and the blog is small enough that its own tag costs nothing.
   */
  blog: 'public-blog',
} as const;
