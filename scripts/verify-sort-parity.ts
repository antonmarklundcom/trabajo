// Asserts that the seed read path orders jobs by the same keys the DB read path
// does (PLAN-PHASE3-DRAFT.md §12.1 "seed-vs-DB sort drift", §13.4 B7).
//
// `npm run db:parity` already compares the two paths' output — but only when a
// populated database is reachable, and only for the tie cases the seed fixture
// happens to contain. That is the "parity quietly tolerating a divergence"
// §12.1 names: with no featured job sharing a salary with a regular one, a
// missing featured tiebreaker produces identical output and parity passes.
//
// This script needs no database. It checks two things instead:
//
//   1. The DB path's ORDER BY clauses are still the ones this file knows about.
//      A change there is the source of truth moving, and it must fail here
//      until lib/data.ts moves with it.
//   2. The seed path's actual output is sorted by those keys — evaluated
//      directly, rather than by comparing two implementations that could drift
//      together.
//
// Where the fixture contains no tie at a given key, that is reported rather
// than passed over in silence: an assertion nothing exercises is not evidence.
import { readFileSync } from 'node:fs';
import rawJobs from '../lib/seed/jobs.json';
import type { Job, JobFilters } from '../lib/types';

let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`ok    ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. The DB path's ORDER BY, pinned as text.
// ---------------------------------------------------------------------------

const queriesSource = readFileSync('lib/db/queries.ts', 'utf8');

const WHY =
  'The DB path is the source of truth (§13.4 B7). If this ORDER BY changed on ' +
  'purpose, change lib/data.ts to match, then update this script.';

console.log('— DB order-by clauses —');

check(
  'queryJobs orden=salario: desc(COALESCE(salaryMin,0)), asc(featured), asc(id)',
  queriesSource.includes(
    '[desc(sql`COALESCE(${jobs.salaryMin}, 0)`), asc(isFeaturedSql()), asc(jobs.id)]',
  ),
  WHY,
);
check(
  'queryJobs default: asc(featured), desc(publishedAt), asc(id)',
  queriesSource.includes('[asc(isFeaturedSql()), desc(jobs.publishedAt), asc(jobs.id)]'),
  WHY,
);
check(
  'queryFeaturedJobs: asc(id)',
  queriesSource.includes('.orderBy(asc(jobs.id))'),
  WHY,
);
check(
  'queryRecentJobs: desc(publishedAt), asc(id)',
  queriesSource.includes('.orderBy(desc(jobs.publishedAt), asc(jobs.id))'),
  WHY,
);

// ---------------------------------------------------------------------------
// 2. The seed path's output, evaluated against those keys.
// ---------------------------------------------------------------------------

process.env.DATA_SOURCE = 'seed';

const fileIndex = new Map((rawJobs as Job[]).map((job, i) => [job.slug, i]));

const featuredRank = (job: Job) =>
  job.featuredUntil && new Date(job.featuredUntil) > new Date() ? 0 : 1;
const salary = (job: Job) => job.salaryMin ?? 0;
const postedAt = (job: Job) => new Date(job.postedAt).getTime();
const index = (job: Job) => fileIndex.get(job.slug) ?? Number.MAX_SAFE_INTEGER;

type Key = { name: string; of: (job: Job) => number; direction: 'asc' | 'desc' };

const ID_KEY: Key = { name: 'id', of: index, direction: 'asc' };

const SALARIO_KEYS: Key[] = [
  { name: 'salaryMin', of: salary, direction: 'desc' },
  { name: 'featured', of: featuredRank, direction: 'asc' },
  ID_KEY,
];

const DEFAULT_KEYS: Key[] = [
  { name: 'featured', of: featuredRank, direction: 'asc' },
  { name: 'postedAt', of: postedAt, direction: 'desc' },
  ID_KEY,
];

const RECENT_KEYS: Key[] = [{ name: 'postedAt', of: postedAt, direction: 'desc' }, ID_KEY];

/** The first adjacent pair that violates the key order, or null. */
function firstViolation(jobs: Job[], keys: Key[]): string | null {
  for (let i = 1; i < jobs.length; i += 1) {
    const prev = jobs[i - 1];
    const next = jobs[i];
    for (const key of keys) {
      const a = key.of(prev);
      const b = key.of(next);
      if (a === b) continue;
      const ordered = key.direction === 'asc' ? a < b : a > b;
      if (!ordered) {
        return `${prev.slug} precedes ${next.slug}, but ${key.name} ${a} must not precede ${b} (${key.direction})`;
      }
      break;
    }
  }
  return null;
}

/** How many adjacent pairs this key actually had to break a tie for. */
function tiesResolvedBy(jobs: Job[], keys: Key[], keyName: string): number {
  let count = 0;
  for (let i = 1; i < jobs.length; i += 1) {
    for (const key of keys) {
      if (key.of(jobs[i - 1]) !== key.of(jobs[i])) break;
      if (key.name === keyName) count += 1;
    }
  }
  return count;
}

async function main() {
  const data = await import('../lib/data');

  console.log('\n— seed ordering —');

  const cases: { orden: NonNullable<JobFilters['orden']>; keys: Key[] }[] = [
    { orden: 'salario', keys: SALARIO_KEYS },
    { orden: 'recientes', keys: DEFAULT_KEYS },
    { orden: 'destacados', keys: DEFAULT_KEYS },
    { orden: 'relevancia', keys: DEFAULT_KEYS },
  ];

  const notExercised: string[] = [];

  for (const { orden, keys } of cases) {
    const { jobs } = await data.getJobs({ orden, page: 1 });
    const violation = firstViolation(jobs, keys);
    check(
      `orden=${orden}: ${keys.map((k) => `${k.direction}(${k.name})`).join(', ')}`,
      violation === null,
      violation ?? '',
    );
    for (const key of keys.slice(1)) {
      if (tiesResolvedBy(jobs, keys, key.name) === 0) {
        notExercised.push(`orden=${orden}: no pair is decided by ${key.name}`);
      }
    }
  }

  console.log('\n— featured and recent lists —');

  const featured = await data.getFeaturedJobs(6);
  check('getFeaturedJobs: asc(id)', firstViolation(featured, [ID_KEY]) === null);
  check(
    'getFeaturedJobs returns only live featured jobs',
    featured.every((job) => featuredRank(job) === 0),
  );

  const recent = await data.getRecentJobs(8);
  check('getRecentJobs: desc(postedAt), asc(id)', firstViolation(recent, RECENT_KEYS) === null);

  if (notExercised.length > 0) {
    // Not a failure: the fixture is what it is, and inventing rows to exercise
    // a tiebreaker would change what `db:parity` compares. Printed so that
    // "these assertions passed" is not read as "these tiebreakers are covered".
    console.log('\nNOT EXERCISED BY lib/seed/jobs.json (vacuous assertions):');
    for (const line of notExercised) console.log(`  - ${line}`);
  }
}

main().then(() => {
  console.log(failures === 0 ? '\nSeed and DB sort keys agree.\n' : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
});
