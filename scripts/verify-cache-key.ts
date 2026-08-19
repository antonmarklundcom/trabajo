// Asserts which public job queries may be cached (PLAN-PHASE3-DRAFT.md §12.1,
// §13.2). Both failure modes here are silent, which is why they are asserted
// rather than reviewed:
//
//   - too permissive, and every distinct `?q=` mints a cache entry on shared
//     Hostinger disk until it fills;
//   - too clever — truncating a value to bound the key — and two different
//     searches share one entry, so one visitor's results are served for
//     another's query.
//
// Pure function of a filter object: no database, no Next runtime.
import { isCacheable, MAX_CACHED_PAGE } from '../lib/db/job-cache-key';
import type { JobFilters } from '../lib/types';

const CATEGORIES = new Set(['tecnologia', 'ventas']);
const CITIES = new Set(['asuncion', 'ciudad-del-este']);

let failures = 0;

function check(label: string, filters: JobFilters, expected: boolean) {
  const actual = isCacheable(filters, CATEGORIES, CITIES);
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — got ${actual}, want ${expected}`}`);
}

console.log('\n— the finding: free text is never cached —');
check('a plain browse is cacheable', {}, true);
check('any free-text search is not', { q: 'ingeniero' }, false);
check('a one-character search is not', { q: 'a' }, false);
check('an empty q is still a plain browse', { q: '' }, true);
check('the other free-text input is not cached either', { salarioMin: 3_000_000 }, false);

console.log('\n— the key space is finite —');
check('a known category is cacheable', { categoria: 'tecnologia' }, true);
check('an unknown category is not', { categoria: 'no-existe' }, false);
check('a known city is cacheable', { ciudad: 'asuncion' }, true);
check('an unknown city is not', { ciudad: 'no-existe' }, false);
check('a known contract type is cacheable', { tipo: 'pasantia' }, true);
check('an invented contract type is not', { tipo: 'inventado' }, false);
check('an invented seniority is not', { nivel: 'inventado' }, false);
check('an invented modality is not', { modality: 'inventado' }, false);
check('an invented sort order is not', { orden: 'inventado' as JobFilters['orden'] }, false);

console.log('\n— pagination is bounded —');
check('page 1 is cacheable', { page: 1 }, true);
check('the last cached page is cacheable', { page: MAX_CACHED_PAGE }, true);
check('one past it is not', { page: MAX_CACHED_PAGE + 1 }, false);
check('deep pagination is not', { page: 999_999 }, false);
check('page 0 is not', { page: 0 }, false);
check('a fractional page is not', { page: 1.5 }, false);
check('NaN is not', { page: Number.NaN }, false);

console.log('\n— combinations —');
check(
  'a fully known filter set is cacheable',
  { categoria: 'ventas', ciudad: 'asuncion', tipo: 'freelance', orden: 'salario', page: 2 },
  true,
);
check(
  'one free-text value disqualifies the whole query',
  { categoria: 'ventas', ciudad: 'asuncion', q: 'x' },
  false,
);

console.log(failures === 0 ? '\nCache key space is bounded and collision-free.\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
