// MySQL's duplicate-key error (ER_DUP_ENTRY, errno 1062), narrowed to one
// named unique index.
//
// Two things make this worth a shared module rather than an inline check:
//
//   1. drizzle-orm (0.44+) does not rethrow the driver's error. Every failed
//      query surfaces as a DrizzleQueryError ("Failed query: …") whose `cause`
//      is the mysql2 error carrying `code` / `errno`. A check that reads
//      `err.code` on the thrown object therefore never matches, and the race
//      it was written for falls through as a 500. So this walks the cause
//      chain instead of trusting the top-level object.
//   2. The index name is required, not optional. A bare ER_DUP_ENTRY test
//      would also swallow a duplicate from some other unique index hit by the
//      same statement (or a future one) and report it as whatever this caller
//      means by "duplicate" — a lie that looks like a feature. MySQL 8 names
//      the key as `table.index` in the message and 5.7 as `index`; a substring
//      match on the index name covers both.
export function isDuplicateKeyOn(err: unknown, indexName: string): boolean {
  let current: unknown = err;
  // Bounded: a cause chain is a couple of links deep, and a cyclic one must
  // not hang a request.
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const e = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if ((e.code === 'ER_DUP_ENTRY' || e.errno === 1062) && (e.message ?? '').includes(indexName)) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
