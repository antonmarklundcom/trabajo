// One implementation of the "cached, unless there is no Next cache" fallback.
//
// `unstable_cache` requires Next's incrementalCache, which only exists inside a
// Next server request or build. Called from a plain tsx script — scripts/
// parity-check.ts via `npm run db:parity`, scripts/verify-blog.ts via
// `npm run blog:verify` — it throws `Invariant: incrementalCache missing`.
// Falling back to the uncached query in that one case is safe because the
// wrapper only memoizes and revalidates a result; it never changes one. Any
// other error (a real database failure) still propagates.
//
// This was written twice, verbatim, in lib/db/queries.ts and lib/blog.ts
// (PLAN-PHASE3-DRAFT.md §12.1). Both copies string-match a message from a Next
// internal, so a Next upgrade that reworded it would break two places quietly
// instead of one place loudly. Hence one module.
//
// Deliberately NOT `server-only`: `npm run db:parity` runs lib/data.ts under
// plain tsx with no react-server condition, and it is one of the two callers
// this fallback exists for.

/** The message Next throws when `unstable_cache` runs outside a Next runtime. */
const NO_INCREMENTAL_CACHE = 'incrementalCache missing';

export async function cachedOrRaw<T>(
  cached: () => Promise<T>,
  raw: () => Promise<T>,
): Promise<T> {
  try {
    return await cached();
  } catch (err) {
    if (err instanceof Error && err.message.includes(NO_INCREMENTAL_CACHE)) {
      return raw();
    }
    throw err;
  }
}
