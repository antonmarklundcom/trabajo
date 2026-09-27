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
import {
  listingIndexRule,
  canonicalFor,
  siteUrl,
  companyRobots,
  companiesWithPublicJobs,
} from '../lib/seo';
import robots from '../app/robots';
import { serializeJsonLd } from '../lib/json-ld';
import { isHttpUrl } from '../lib/company-website';
import { uniqueSlug } from '../lib/slug';

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

{
  // A hardcoded 4-file list only proves those 4 files are clean — a stray
  // reference left in a fifth file (a new component, a migration script, a
  // blog draft) would not be "gone from the whole codebase" at all and this
  // check would not notice. Scan the real source tree instead.
  const SEARCH_DIRS = ['app', 'components', 'lib'];
  const SKIP_DIRS = new Set(['node_modules', '.next']);

  function walkSource(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(ROOT, dir))) {
      if (SKIP_DIRS.has(entry)) continue;
      const rel = `${dir}/${entry}`;
      if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walkSource(rel));
      else if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel);
    }
    return out;
  }

  const offenders = SEARCH_DIRS.flatMap(walkSource).filter((file) =>
    code(read(file)).includes('relevancia'),
  );

  check(
    "the 'relevancia' sort is gone from the whole codebase",
    offenders.length === 0,
    `Found in: ${offenders.join(', ') || 'nowhere'}. It was a fourth label for the ORDER BY ` +
      '`recientes` already produced, so every URL it appeared in was a duplicate of one that ' +
      'already existed.',
  );
}

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

// ---------------------------------------------------------------------------
// 7. JSON-LD cannot close its own <script>.
//
//    Company names, websites and job titles typed by outside parties reach
//    JSON-LD. JSON.stringify leaves `</script>` intact, and the HTML parser
//    acts on it before any JSON parser runs — so the serialiser is evaluated
//    against hostile input here, and every page is read to prove it uses it.
// ---------------------------------------------------------------------------

{
  const hostile = {
    name: '</script><script>alert(1)</script>',
    sameAs: 'https://x.test/?a=<b>&c=\u2028',
    nested: [{ title: '<!-- --><SCRIPT>' }],
  };
  const out = serializeJsonLd(hostile);
  check('serializeJsonLd output contains no "<"', !out.includes('<'), out);
  check('serializeJsonLd output contains no ">"', !out.includes('>'), out);
  check('serializeJsonLd output contains no raw U+2028', !out.includes('\u2028'), out);
  check(
    'serializeJsonLd round-trips to the identical value',
    JSON.stringify(JSON.parse(out)) === JSON.stringify(hostile),
    out,
  );

  const inlined = [...walk('app'), ...walk('components')].filter(
    (file) =>
      file.endsWith('.tsx') &&
      /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(code(read(file))),
  );
  check(
    'no page or component inlines JSON.stringify into dangerouslySetInnerHTML',
    inlined.length === 0,
    `Use <JsonLd data={…} /> (components/JsonLd.tsx) instead: ${inlined.join(', ')}`,
  );

  check('isHttpUrl accepts an https URL', isHttpUrl('https://empresa.com.py'));
  check('isHttpUrl rejects javascript:', !isHttpUrl('javascript:alert(1)'));
  check('isHttpUrl rejects markup', !isHttpUrl('</script><script>alert(1)</script>'));
  check('isHttpUrl rejects data:', !isHttpUrl('data:text/html,<script>alert(1)</script>'));

  const websiteWriters = walk('app/api').filter(
    (file) => file.endsWith('route.ts') && /\bwebsite\s*:/.test(code(read(file))),
  );
  check('the company-website writers are found', websiteWriters.length >= 3, websiteWriters.join(', '));
  for (const file of websiteWriters) {
    check(
      `${file} validates website with companyWebsiteSchema`,
      /website:\s*companyWebsiteSchema/.test(code(read(file))),
      'A free-text website ends up in hiringOrganization.sameAs on every job of that company.',
    );
  }
}

// ---------------------------------------------------------------------------
// 8. Company pages, /empresas/[slug] (PLAN-GROWTH.md §4 D5).
//
//    Same invisibility as everything above: an indexable empty profile is a
//    thin page Google learns to distrust, a sitemap that lists one sends Search
//    Console a contradictory signal, and a followed link to an employer-typed
//    website is an endorsement nobody decided to give. None changes a pixel.
// ---------------------------------------------------------------------------

{
  check('a company with zero public jobs is noindex', companyRobots(0).index === false);
  check('a company with zero public jobs is still follow', companyRobots(0).follow === true,
    'The page still links to the catalogue; nofollow would cut that path for nothing.');
  check('a company with one public job is indexable', companyRobots(1).index === true);
  check('a company with many public jobs is indexable', companyRobots(12).index === true);

  const listed = companiesWithPublicJobs([
    { companySlug: 'kia-paraguay', updatedAt: '2026-06-01T00:00:00Z' },
    { companySlug: 'kia-paraguay', updatedAt: '2026-06-09T00:00:00Z' },
    { companySlug: 'banco-continental', updatedAt: '2026-05-01T00:00:00Z' },
  ]);
  check(
    'the sitemap company set is exactly the companies with a public job',
    listed.size === 2 && listed.has('kia-paraguay') && listed.has('banco-continental'),
    `Got: ${[...listed.keys()].join(', ')}`,
  );
  check(
    "a company's sitemap lastmod is its latest job update",
    listed.get('kia-paraguay')?.toISOString() === '2026-06-09T00:00:00.000Z',
    String(listed.get('kia-paraguay')?.toISOString()),
  );
  check('no public jobs means no company in the sitemap', companiesWithPublicJobs([]).size === 0);

  const page = code(read('app/empresas/[slug]/page.tsx'));
  check(
    '/empresas/[slug] takes robots from companyRobots(company.jobCount)',
    /robots:\s*companyRobots\(company\.jobCount\)/.test(page),
    'A second copy of the rule inside generateMetadata is a second rule.',
  );
  check(
    '/empresas/[slug] canonical is the company slug',
    page.includes('canonicalFor(`/empresas/${company.slug}`)'),
  );

  const websiteAnchor = page.match(/<a\b[^>]*href=\{company\.website\}[^>]*>/)?.[0] ?? '';
  check('the company website link is inspectable', websiteAnchor.length > 0,
    'Could not find <a href={company.website}> in app/empresas/[slug]/page.tsx.');
  const rel = websiteAnchor.match(/rel="([^"]*)"/)?.[1].split(/\s+/) ?? [];
  check(
    'the company website link carries rel=nofollow',
    rel.includes('nofollow'),
    `Got rel="${rel.join(' ')}". The address is employer-typed; the site does not vouch for it.`,
  );
  check(
    'the company website link carries noopener noreferrer with target=_blank',
    rel.includes('noopener') && rel.includes('noreferrer') && websiteAnchor.includes('target="_blank"'),
    websiteAnchor,
  );
  check(
    'the Organization JSON-LD goes through <JsonLd>',
    page.includes("'@type': 'Organization'") && page.includes('<JsonLd data={organizationJsonLd} />'),
  );

  const dataSource = code(read('lib/data.ts'));
  const getCompanyBody = dataSource.slice(dataSource.indexOf('export async function getCompany('));
  check(
    'getCompany() re-checks the website with isHttpUrl for both sources',
    /isHttpUrl\(company\.website\)/.test(getCompanyBody.slice(0, getCompanyBody.indexOf('\n}'))),
    'The website becomes an href and a sameAs; rows older than companyWebsiteSchema were never validated.',
  );

  const sitemap = code(read('app/sitemap.ts'));
  check(
    'the sitemap lists companies only through companiesWithPublicJobs()',
    sitemap.includes('companiesWithPublicJobs(jobs)') &&
      (sitemap.match(/\/empresas\//g) ?? []).length === 1 &&
      !sitemap.includes('getCompany'),
    'Listing companies from anywhere but the public-job walk can list one with nothing to index.',
  );

  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((rule) =>
    rule.disallow === undefined ? [] : Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow],
  );
  check(
    'robots.txt does not disallow /empresas/',
    !disallow.some((prefix) => '/empresas/kia-paraguay'.startsWith(prefix)),
    `Disallow: ${disallow.join(', ')}. robots.txt matches by prefix, so '/empresa' without its ` +
      'trailing slash would hide every public company page.',
  );
  check(
    'robots.txt still disallows the employer panel /empresa/',
    disallow.some((prefix) => '/empresa/empleos'.startsWith(prefix)),
    `Disallow: ${disallow.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// Slugs always fit their column, suffix included.
// ---------------------------------------------------------------------------

async function checkSlugLengths(): Promise<void> {
  const title = 'Coordinador de gestion administrativa '.repeat(8).slice(0, 200);
  const taken = new Set<string>();
  const exists = async (candidate: string) => taken.has(candidate);
  let longest = 0;
  for (let i = 0; i < 12; i++) {
    const slug = await uniqueSlug(title, exists);
    taken.add(slug);
    longest = Math.max(longest, slug.length);
  }
  check(
    'uniqueSlug never exceeds the narrowest slug column (200), even with a suffix',
    longest <= 200,
    `longest slug was ${longest} chars`,
  );
  check('uniqueSlug never ends in a dash after the cap', ![...taken].some((s) => /-$/.test(s)));
}

void checkSlugLengths().then(() => {
  if (failures > 0) {
    console.error(`\n${failures} assertion(s) FAILED.`);
    process.exit(1);
  }
  console.log('\nAll SEO index-control assertions passed.');
  process.exit(0);
});
