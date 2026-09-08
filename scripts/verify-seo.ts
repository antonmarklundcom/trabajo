// Asserts the catalogue's index-control rules:
//
//   npm run seo:verify
//
// What makes these worth a script rather than a review note is that every way
// of getting them wrong is invisible. A wrong `noindex` removes pages from
// search and changes not one pixel. A wrong canonical merges two pages that
// are not the same page, and the only place it shows is a Search Console
// report weeks later. Neither `next build`, nor lint, nor a click-through can
// tell a correct rule table from an inverted one.
//
// Two halves, deliberately:
//
//   1. The rule table is EVALUATED (lib/seo.ts is pure, so this is a real
//      unit test of the policy, not a grep for its shape).
//   2. The wiring is READ FROM SOURCE — that the route applies the table
//      rather than reimplementing it, and that every public page declares a
//      canonical at all.
//
// No database, no env, no network.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listingIndexRule, canonicalFor, siteUrl } from '../lib/seo';

const ROOT = process.cwd();

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

function code(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. The paginated bare listing stays INDEXABLE and self-canonical.
//
//    First, because it is the rule most likely to be "tidied" into a bug.
//    Canonicalising /empleos?page=2 to /empleos looks like duplicate-content
//    hygiene and is the opposite: it tells Google that page 2 IS page 1, and
//    every listing that appears only on page 2 loses its indexable home. The
//    tail of the catalogue is most of the catalogue.
// ---------------------------------------------------------------------------

for (const page of [2, 3, 17]) {
  const rule = listingIndexRule({ page });
  check(
    `/empleos?page=${page} is indexable`,
    rule.index === true,
    'Pagination is not duplication — it is the rest of the content.',
  );
  check(
    `/empleos?page=${page} canonicalises to itself`,
    rule.canonical === `/empleos?page=${page}`,
    `Got ${rule.canonical}. Pointing page ${page} at /empleos deindexes everything that ` +
      'only appears on it.',
  );
  check(`/empleos?page=${page} is reported as paginated`, rule.reason === 'paginated');
}

// ---------------------------------------------------------------------------
// 2. The rest of the table.
// ---------------------------------------------------------------------------

{
  const bare = listingIndexRule({});
  check('/empleos is indexable', bare.index === true);
  check('/empleos canonicalises to itself with no query', bare.canonical === '/empleos');
  check('/empleos?page=1 is the same URL as /empleos', listingIndexRule({ page: 1 }).canonical === '/empleos');
}

{
  const rule = listingIndexRule({ categoria: 'ventas' });
  check('?categoria=X is noindexed', rule.index === false);
  check('?categoria=X canonicalises to /trabajo/X', rule.canonical === '/trabajo/ventas', rule.canonical);
  check(
    '?categoria=X&page=2 still canonicalises to the landing',
    listingIndexRule({ categoria: 'ventas', page: 2 }).canonical === '/trabajo/ventas',
    'The landing is the address for this content whichever page of it you are on.',
  );
}

{
  const rule = listingIndexRule({ categoria: 'ventas', ciudad: 'asuncion' });
  check('?categoria=X&ciudad=Y is noindexed', rule.index === false);
  check(
    '?categoria=X&ciudad=Y canonicalises to /trabajo/X/Y',
    rule.canonical === '/trabajo/ventas/asuncion',
    rule.canonical,
  );
}

{
  const rule = listingIndexRule({ ciudad: 'asuncion' });
  check('?ciudad=Y is noindexed', rule.index === false);
  // S4 shipped /trabajo-en/{ciudad} (PLAN-GROWTH.md §7 D7), updated here
  // together with the rule in lib/seo.ts as the old comment asked.
  check(
    '?ciudad=Y canonicalises to /trabajo-en/{ciudad}',
    rule.canonical === '/trabajo-en/asuncion',
    rule.canonical,
  );
}

for (const [key, value] of [
  ['q', 'vendedor'],
  ['tipo', 'medio_tiempo'],
  ['nivel', 'junior'],
  ['modalidad', 'remoto'],
  ['salario_min', '3000000'],
  ['orden', 'salario'],
] as const) {
  const rule = listingIndexRule({ [key]: value });
  check(`?${key}= is noindexed`, rule.index === false);
  check(`?${key}= canonicalises to /empleos`, rule.canonical === '/empleos', rule.canonical);
}

check(
  'an open-ended parameter beats a taxonomy one',
  listingIndexRule({ categoria: 'ventas', q: 'zona' }).canonical === '/empleos',
  'A search inside a category is not the category landing, and saying it is would claim ' +
    'two different result sets are one page.',
);

check(
  'an empty parameter value is the same as an absent one',
  listingIndexRule({ categoria: '', q: '  ' }).index === true,
  '`?categoria=` is the bare listing with a stray ampersand, not a filtered page.',
);

// ---------------------------------------------------------------------------
// 3. Canonicals are absolute, and built from NEXT_PUBLIC_SITE_URL.
//
//    A relative canonical resolves against whatever host served the page —
//    which on this deploy includes the Hostinger preview domain (DEPLOY.md).
//    A preview host emitting relative canonicals tells Google the preview is
//    the original.
// ---------------------------------------------------------------------------

check(
  'canonicalFor() produces an absolute URL',
  canonicalFor('/empleos').startsWith('http'),
  canonicalFor('/empleos'),
);

check(
  'canonicalFor() does not double the slash',
  !canonicalFor('/empleos').replace(/^https?:\/\//, '').includes('//'),
  canonicalFor('/empleos'),
);

check('siteUrl() carries no trailing slash', !siteUrl().endsWith('/'), siteUrl());

// ---------------------------------------------------------------------------
// 4. The route applies the table rather than reimplementing it.
// ---------------------------------------------------------------------------

const listing = code(read('app/empleos/page.tsx'));

check(
  '/empleos metadata is built from the rule table',
  listing.includes('listingIndexRule(') && listing.includes('canonicalFor(rule.canonical)'),
  'A second copy of the policy inside generateMetadata is a second policy.',
);

check(
  '/empleos declares robots from the rule, with follow always true',
  /robots:\s*\{\s*index:\s*rule\.index,\s*follow:\s*true\s*\}/.test(listing),
  'A noindexed filtered page is still a crawl path to the listings on it. `nofollow` here ' +
    "would cut the catalogue's tail off from the crawler while looking tidier.",
);

check(
  '/empleos has an h1',
  /<h1[\s>]/.test(listing),
  'The one element a crawler reads as the page topic was missing from the site\'s most ' +
    'important listing URL.',
);

check(
  '/empleos server-renders links into the taxonomy tier',
  listing.includes('href={`/trabajo/${cat.slug}`}'),
  'The rule table canonicalises filtered URLs INTO the landings; it only works if those ' +
    'landings can be reached without running client-side JavaScript.',
);

check(
  "the 'relevancia' sort is gone from the whole codebase",
  ['components/SortControl.tsx', 'lib/types.ts', 'lib/db/job-cache-key.ts', 'app/empleos/page.tsx']
    .every((file) => !code(read(file)).includes('relevancia')),
  'It was a fourth label for the ORDER BY `recientes` already produced, so every URL it ' +
    'appeared in was a duplicate of one that already existed.',
);

// ---------------------------------------------------------------------------
// 5. Every public page declares a canonical.
//
//    The account trees (/admin, /empresa, /postulante) are excluded: they are
//    noindex by construction and a canonical on them would be meaningless.
// ---------------------------------------------------------------------------

const EXCLUDED = ['app/admin/', 'app/empresa/', 'app/postulante/', 'app/api/'];

const publicPages = walk('app').filter(
  (file) => file.endsWith('/page.tsx') && !EXCLUDED.some((prefix) => file.startsWith(prefix)),
);

check(
  'the public page list is non-empty',
  publicPages.length >= 10,
  `Found ${publicPages.length}. If the app tree moved, move this check with it.`,
);

for (const file of publicPages) {
  const source = code(read(file));
  check(
    `${file} declares alternates.canonical`,
    /alternates:\s*\{[^}]*canonical/.test(source),
    'Without one, every query string, host and trailing-slash variant of this URL is a ' +
      'separate page as far as Google is concerned.',
  );
}

// ---------------------------------------------------------------------------
// 6. The JobPosting validThrough comes from expiresAt, never featuredUntil
//    (PLAN-GROWTH.md §4 S2's assertion on S3's fix).
// ---------------------------------------------------------------------------

{
  const detail = code(read('app/empleos/[slug]/page.tsx'));
  const jsonLdStart = detail.indexOf('JobPosting');
  const jsonLdEnd = detail.indexOf('BreadcrumbList');
  const jsonLd = jsonLdStart !== -1 && jsonLdEnd > jsonLdStart ? detail.slice(jsonLdStart, jsonLdEnd) : '';

  check(
    'the JobPosting block is inspectable',
    jsonLd.length > 0,
    'Could not locate the JobPosting JSON-LD in app/empleos/[slug]/page.tsx.',
  );
  check(
    'validThrough is derived from expiresAt',
    /validThrough:\s*job\.expiresAt/.test(jsonLd),
    'Google accepts a missing validThrough; it does not accept a wrong one.',
  );
  check(
    'featuredUntil does not appear in the JobPosting block',
    !jsonLd.includes('featuredUntil'),
    'A paid promotion ending is not a job posting expiring. That conflation is the Search ' +
      'Console error this rule exists to keep fixed.',
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll SEO index-control assertions passed.');
process.exit(0);
