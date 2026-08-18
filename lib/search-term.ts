// Free-text search input, canonicalised in one place.
//
// PLAN-PHASE3-DRAFT.md §12.1 (unbounded cache cardinality), PR B2. `q` is the
// only public filter that is not drawn from a finite set, which makes it the
// only one that can be used to grow something without limit — the cache on
// disk before B2, the LIKE scan after it. Both halves of the seam import this,
// so seed and DB agree on what a search term IS before they disagree about
// anything else.
//
// Pure and free of `server-only`: lib/data.ts's seed path reads it under plain
// tsx in scripts/parity-check.ts.

/**
 * Longer than any real search on a job board — the longest job title in the
 * seed data is comfortably under this — and short enough that the term cannot
 * be used to push kilobytes into a LIKE scan or a log line.
 *
 * Truncation is silent on purpose. A visitor who pastes an essay into the
 * search box gets results for the first 64 characters, which is a better answer
 * than an error about a limit they did not know existed.
 */
export const MAX_SEARCH_TERM_LENGTH = 64;

/**
 * The canonical form of a search term, or `null` when there is no search.
 *
 * Collapsing whitespace and lowercasing are not cosmetic: `"  Ventas  "`,
 * `"ventas"` and `"Ventas"` are one query, and treating them as three is what
 * made the cache key space larger than it had to be even before free text made
 * it unbounded.
 */
export function normalizeSearchTerm(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_SEARCH_TERM_LENGTH);
}

/**
 * Escapes the characters LIKE treats as wildcards.
 *
 * Not an injection defence — drizzle parameterises the value, and it was never
 * interpolated into SQL text. This is about the query the visitor actually
 * asked for: without it, searching for `50%` means "anything containing 50",
 * and a search for `%` alone means "every published job", which is a full scan
 * bought with one keystroke.
 *
 * Backslash first, or it would escape the escapes added after it.
 */
export function escapeLikeWildcards(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
