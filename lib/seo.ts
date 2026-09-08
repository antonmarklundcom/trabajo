// Canonical URLs and the indexability rule for the job catalogue's filtered
// URLs (PLAN-GROWTH.md §4 S2).
//
// The problem this exists for: /empleos accepts nine query parameters, so the
// number of URLs that serve a subset of the same catalogue is combinatorial.
// Left uncanonicalised they compete with each other and with the taxonomy
// landings for the same queries, and Google spends its crawl budget on
// permutations instead of on listings.
//
// The rule table below is the whole policy, in one place, written as data. It
// is asserted from source by `npm run seo:verify`, because every way of
// getting it wrong is invisible in a browser: a wrong `noindex` silently
// removes pages from search, a wrong canonical silently merges two pages that
// are not the same one, and neither changes a pixel.
//
// Deliberately NOT `server-only`: it is pure string work over a plain object,
// scripts/verify-seo.ts imports it under plain tsx, and there is nothing in it
// a client could learn.

/**
 * The site's own origin, with no trailing slash.
 *
 * Every canonical on this site is absolute. A relative canonical resolves
 * against whatever host served the page, which on this deploy includes the
 * Hostinger preview domain (DEPLOY.md) — and a preview host emitting relative
 * canonicals tells Google the preview is the original.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py').replace(/\/+$/, '');
}

/**
 * Absolute canonical for a site-relative path.
 *
 * `path` must start with `/` and already carry any query string that belongs
 * in the canonical — which, for every case in the table below, means either
 * nothing or `?page=N`.
 */
export function canonicalFor(path: string): string {
  return `${siteUrl()}${path}`;
}

/** What `generateMetadata` needs in order to answer for a /empleos URL. */
export type ListingParams = {
  categoria?: string;
  ciudad?: string;
  q?: string;
  tipo?: string;
  nivel?: string;
  modalidad?: string;
  salario_min?: string;
  orden?: string;
  page?: number;
};

export type IndexRule = {
  /** Whether Google may index THIS URL. `follow` is always true — see below. */
  index: boolean;
  /** Site-relative canonical, query string included when it belongs there. */
  canonical: string;
  /** Which row of the table decided it. Surfaced for seo:verify and for humans. */
  reason:
    | 'bare'
    | 'paginated'
    | 'categoria'
    | 'categoria+ciudad'
    | 'ciudad'
    | 'open-ended';
};

/**
 * The parameters that make a /empleos URL a SEARCH RESULT rather than a slice
 * of the catalogue.
 *
 * `q` and `salario_min` are free text — unbounded, so unbounded URLs. `tipo`,
 * `nivel` and `modalidad` are closed sets, but each one multiplies the
 * permutations without producing a page anyone searches for ("empleos de medio
 * tiempo junior híbridos" is not a query). `orden` re-sorts the same rows into
 * a second address for the same content, which is duplication by definition.
 */
const OPEN_ENDED_PARAMS = ['q', 'tipo', 'nivel', 'modalidad', 'salario_min', 'orden'] as const;

/**
 * THE rule table (PLAN-GROWTH.md §4 S2).
 *
 * | URL shape                         | robots         | canonical              |
 * |-----------------------------------|----------------|------------------------|
 * | /empleos                          | index          | /empleos               |
 * | /empleos?page=N                   | index          | self, /empleos?page=N  |
 * | /empleos?categoria=X [+page]      | noindex, follow| /trabajo/X             |
 * | /empleos?categoria=X&ciudad=Y [+] | noindex, follow| /trabajo/X/Y           |
 * | /empleos?ciudad=Y [+page]         | noindex, follow| /empleos (until S4)    |
 * | anything with an open-ended param | noindex, follow| /empleos               |
 *
 * Two decisions worth stating out loud, because both are easy to "fix" wrongly:
 *
 *   - **`follow` is always true, even where `index` is false.** A noindexed
 *     filtered page is still a crawl path to the listings on it. `nofollow`
 *     here would cut the catalogue's tail off from the crawler while looking
 *     like a tidier rule.
 *
 *   - **`?page=N` stays INDEXABLE and self-canonical.** Canonicalising page 2
 *     to page 1 tells Google those are the same page, and the listings that
 *     appear only on page 2 then have no indexable home. Pagination is not
 *     duplication; it is the rest of the content.
 *
 * The filtered rows canonicalise to the taxonomy landing that serves the same
 * rows under a real URL — that is why they exist and why /empleos?categoria=
 * does not need to.
 */
export function listingIndexRule(params: ListingParams): IndexRule {
  const page = params.page && params.page > 1 ? params.page : undefined;
  const pageSuffix = page ? `?page=${page}` : '';

  const hasOpenEnded = OPEN_ENDED_PARAMS.some((key) => {
    const value = params[key];
    return typeof value === 'string' && value.trim() !== '';
  });

  // Anything open-ended wins over everything: `?categoria=ventas&q=zona` is a
  // search inside a category, not the category landing, and pointing its
  // canonical at /trabajo/ventas would claim two different result sets are one.
  if (hasOpenEnded) {
    return { index: false, canonical: '/empleos', reason: 'open-ended' };
  }

  const categoria = nonEmpty(params.categoria);
  const ciudad = nonEmpty(params.ciudad);

  if (categoria && ciudad) {
    return {
      index: false,
      canonical: `/trabajo/${categoria}/${ciudad}`,
      reason: 'categoria+ciudad',
    };
  }
  if (categoria) {
    return { index: false, canonical: `/trabajo/${categoria}`, reason: 'categoria' };
  }
  if (ciudad) {
    // S4 introduces /trabajo-en/{ciudad} (PLAN-GROWTH.md §7 D7) and this line
    // becomes `/trabajo-en/${ciudad}`. Until that route exists, canonicalising
    // to it would point at a 404, which is worse than pointing at the index.
    return { index: false, canonical: '/empleos', reason: 'ciudad' };
  }

  // A bare listing, page 1 or page N. `?page=1` never appears in a canonical:
  // components/Pagination.tsx already omits it, and one address for the first
  // page is the whole point of a canonical.
  return {
    index: true,
    canonical: `/empleos${pageSuffix}`,
    reason: page ? 'paginated' : 'bare',
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
