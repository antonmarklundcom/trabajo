// npm run search:verify — PR B2's properties (PLAN-PHASE3-DRAFT.md §12.1,
// unbounded cache cardinality).
//
// Two of the three properties below are the kind that pass silently when
// broken. A cache entry per distinct `?q=` looks exactly like a working cache
// until the disk is full, and a `%` reaching LIKE unescaped looks exactly like
// a search that matched a lot of rows. Neither shows up in a page that renders.
//
// Pure functions, no database, no Next runtime.
import { escapeLikeWildcards, MAX_SEARCH_TERM_LENGTH, normalizeSearchTerm } from '../lib/search-term';

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failures += 1;
  }
}

console.log('\nnormalisation — one query, one form');

check('trims', normalizeSearchTerm('  ventas  ') === 'ventas');
check('collapses inner whitespace', normalizeSearchTerm('ventas   asuncion') === 'ventas asuncion');
check('lowercases', normalizeSearchTerm('Ventas') === 'ventas');
check(
  'the three spellings agree',
  normalizeSearchTerm('  Ventas ') === normalizeSearchTerm('ventas') &&
    normalizeSearchTerm('VENTAS') === normalizeSearchTerm('ventas'),
);

console.log('\nnormalisation — absence is null, not an empty search');

check('undefined', normalizeSearchTerm(undefined) === null);
check('empty string', normalizeSearchTerm('') === null);
check('whitespace only', normalizeSearchTerm('     ') === null);

console.log('\nnormalisation — bounded length');

const long = 'a'.repeat(5_000);
check(
  `truncated to ${MAX_SEARCH_TERM_LENGTH}`,
  normalizeSearchTerm(long)?.length === MAX_SEARCH_TERM_LENGTH,
);
check('truncation does not throw on multibyte input', normalizeSearchTerm('ñ'.repeat(500)) !== null);

console.log('\nLIKE metacharacters cannot become wildcards');

check('percent is escaped', escapeLikeWildcards('50%') === '50\\%');
check('underscore is escaped', escapeLikeWildcards('a_b') === 'a\\_b');
check('backslash is escaped first', escapeLikeWildcards('a\\b') === 'a\\\\b');
check(
  'a lone percent cannot become match-everything',
  escapeLikeWildcards(normalizeSearchTerm('%')!) === '\\%',
);
check('ordinary text is untouched', escapeLikeWildcards('ventas asuncion') === 'ventas asuncion');

console.log('\nthe cache key space is finite');

// The statement of the bug: before B2, every distinct `?q=` became a distinct
// cache entry. getJobs() now serves searches uncached, so the assertion here is
// on the input side — the thing that decides which branch getJobs() takes must
// be the same normalisation the SQL uses, or a search could be cached under a
// key that does not match the query that ran.
{
  const distinct = new Set<string>();
  for (let i = 0; i < 10_000; i += 1) distinct.add(normalizeSearchTerm(`term ${i}`)!);
  check(
    `10,000 crawler terms are 10,000 distinct terms (${distinct.size}) — which is why they are not cached`,
    distinct.size === 10_000,
  );
}

check(
  'a search is always detected as a search, whatever its spelling',
  ['x', ' X ', 'X  Y', '%'].every((raw) => normalizeSearchTerm(raw) !== null),
);
check(
  'a non-search is never mistaken for one',
  [undefined, '', '   ', '\t\n'].every((raw) => normalizeSearchTerm(raw) === null),
);

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All search term checks passed.');
