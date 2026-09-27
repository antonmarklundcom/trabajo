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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
check('a company filter is not cached (open set, no membership list)', { empresa: 'kia-paraguay' }, false);
check('an empty company filter is still a plain browse', { empresa: '' }, true);

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

// ---------------------------------------------------------------------------
// Every page that reads the job catalogue is refreshed by a job write.
//
// lib/cache.ts keeps a hand-written PUBLIC_PATHS list, and /trabajo-en/[ciudad]
// was missing from it for months: a job approval showed up on /trabajo/... at
// once and on the city landing only when its 300s timer ran out. This finds
// every page under app/ that imports a JOB read from lib/data.ts and requires
// its route to be in the list. Taxonomy-only reads (getCategories, getCities)
// don't count: those lists are fixed, not written by admin or employers.
// ---------------------------------------------------------------------------
console.log('\n— every job-reading page is invalidated on a job write —');
{

  const JOB_READS = /\b(getJobs|getJob|getRecentJobs|getFeaturedJobs|getClosedJob|getCompany|getCompanyJobs|getAllPublishedJobSummaries)\b/;
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  const cacheSource = readFileSync('lib/cache.ts', 'utf8');
  const listStart = cacheSource.indexOf('const PUBLIC_PATHS');
  const listBody = cacheSource.slice(listStart, cacheSource.indexOf('];', listStart));
  const listed = new Set([...listBody.matchAll(/\['([^']+)'/g)].map((m) => m[1]));

  const pages = walk('app').filter((f) => f.endsWith('/page.tsx') && !f.startsWith('app/admin') && !f.startsWith('app/empresa/') && !f.startsWith('app/postulante'));
  let found = 0;
  for (const file of pages) {
    const src = readFileSync(file, 'utf8');
    const dataImport = src.match(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/data'/);
    if (!dataImport || !JOB_READS.test(dataImport[1])) continue;
    found += 1;
    // app/trabajo-en/[ciudad]/page.tsx -> /trabajo-en/[ciudad]; route groups dropped.
    const route =
      '/' +
      file
        .replace(/^app\//, '')
        .replace(/\/?page\.tsx$/, '')
        .split('/')
        .filter((seg) => seg && !/^\(.*\)$/.test(seg))
        .join('/');
    const ok = listed.has(route);
    if (!ok) failures += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${route} is in lib/cache.ts PUBLIC_PATHS${ok ? '' : ` — ${file} reads jobs but a job write never refreshes it`}`);
  }
  const sane = found >= 6;
  if (!sane) failures += 1;
  console.log(`${sane ? 'ok  ' : 'FAIL'}  the scan found the job-reading pages (${found})`);
}

console.log(failures === 0 ? '\nCache key space is bounded and collision-free.\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
