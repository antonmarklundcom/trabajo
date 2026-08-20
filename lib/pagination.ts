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
