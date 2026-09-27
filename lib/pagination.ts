// How many jobs a page of results holds.
//
// One constant because three places have to agree on it: the seed read path
// (lib/data.ts), the DB read path (lib/db/queries.ts), and the pagination
// control on /empleos, which divides the total by it to know how many pages
// there are. A number that drifts between the readers and the control produces
// a last page number that shows an empty list — no error, no 404, just a
// visitor at the end of a catalogue that appears to have run out early.
//
// Deliberately not `server-only`: this is a number, and a client component that
// needs it should not have to be given a copy.

/** PLAN-NEXT.md §3 U2 kept the existing size; changing it changes every URL. */
export const JOBS_PAGE_SIZE = 20;

/**
 * How many posts a page of /blog or a category archive holds (PLAN-GROWTH.md
 * §4 C2). Same reason as above for being one constant: the query's LIMIT and
 * the control's page count must divide by the same number.
 */
export const BLOG_PAGE_SIZE = 12;

/**
 * `?page=N` → N, for the blog listings. Anything that is not a plain positive
 * integer (`abc`, `2.5`, `-1`, `1e3`) is page 1 rather than an error — the URL
 * is then served under its bare canonical, which is where a crawler that
 * mangled the parameter should land anyway.
 */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  const n = Number(value);
  return n >= 1 ? n : 1;
}
