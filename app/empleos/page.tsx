import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJobs, getCategories, getCities } from '@/lib/data';
import { canonicalFor, listingIndexRule, type ListingParams } from '@/lib/seo';
import { categoryLabel, cityLabel } from '@/lib/labels';
import { contractTypeLabel, modalityLabel, seniorityLabel } from '@/lib/formatters';
import type { ContractType, Modality, Seniority } from '@/lib/types';
import type { Category, City, JobFilters } from '@/lib/types';
import JobCard from '@/components/JobCard';
import FilterPanel from '@/components/FilterPanel';
import SortControl from '@/components/SortControl';
import SearchBar from '@/components/SearchBar';
import Pagination from '@/components/Pagination';
import { JOBS_PAGE_SIZE } from '@/lib/pagination';
import JsonLd from '@/components/JsonLd';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type SearchParams = { [key: string]: string | string[] | undefined };


function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

function positiveNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * The URL as lib/seo.ts's rule table sees it.
 *
 * Read in ONE place and used by both generateMetadata and the page body, so
 * the canonical a crawler is given and the results a visitor is shown are
 * derived from the same reading of the same URL.
 */
function listingParams(sp: SearchParams): ListingParams {
  return {
    categoria: param(sp, 'categoria'),
    ciudad: param(sp, 'ciudad'),
    q: param(sp, 'q'),
    tipo: param(sp, 'tipo'),
    nivel: param(sp, 'nivel'),
    modalidad: param(sp, 'modalidad'),
    salario_min: param(sp, 'salario_min'),
    orden: param(sp, 'orden'),
    page: positiveNumber(param(sp, 'page')),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const params = listingParams(sp);
  // The whole indexability policy for this route is one call. Nothing below
  // re-derives it, and scripts/verify-seo.ts asserts that this function is
  // where it is applied.
  const rule = listingIndexRule(params);

  const pageSuffix = params.page && params.page > 1 ? ` — página ${params.page}` : '';
  // A query is visitor-typed and unbounded; the <title> quotes at most 60
  // characters of it.
  const shownQuery =
    params.q && params.q.length > 60 ? `${params.q.slice(0, 60).trimEnd()}…` : params.q;
  const title = shownQuery
    ? `Empleos de "${shownQuery}"${params.ciudad ? ` en ${cityLabel(params.ciudad)}` : ''}`
    : params.categoria && params.ciudad
      ? `Empleos de ${categoryLabel(params.categoria)} en ${cityLabel(params.ciudad)}${pageSuffix}`
      : params.categoria
        ? `Empleos de ${categoryLabel(params.categoria)} en Paraguay${pageSuffix}`
        : params.ciudad
          ? `Empleos en ${cityLabel(params.ciudad)}${pageSuffix}`
          : `Todos los empleos en Paraguay${pageSuffix}`;

  return {
    title,
    description: `Buscá empleos en Paraguay. Filtrá por categoría, ciudad, modalidad y más.`,
    // `follow` is true on every row of the table, including the noindexed
    // ones: a filtered page nobody should index is still a crawl path to the
    // listings on it (lib/seo.ts).
    robots: { index: rule.index, follow: true },
    alternates: { canonical: canonicalFor(rule.canonical) },
  };
}

export default async function EmpleosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const filters: JobFilters = {
    q: param(sp, 'q'),
    categoria: param(sp, 'categoria'),
    ciudad: param(sp, 'ciudad'),
    tipo: param(sp, 'tipo'),
    nivel: param(sp, 'nivel'),
    modality: param(sp, 'modalidad'),
    // `Number()` on a non-numeric query string yields NaN, which used to reach
    // the SQL comparison and the cache key intact. Anything that is not a
    // usable number is simply no filter.
    salarioMin: positiveNumber(param(sp, 'salario_min')),
    orden: (param(sp, 'orden') as JobFilters['orden']) ?? 'recientes',
    page: positiveNumber(param(sp, 'page')) ?? 1,
  };

  const [{ jobs, total }, categories, cities] = await Promise.all([
    getJobs(filters),
    getCategories(),
    getCities(),
  ]);

  // A page number past the last one is a 404, not an empty, indexable 200.
  if (filters.page && filters.page > 1 && jobs.length === 0) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
    ],
  };

  // "Empleos de {categoría} en {ciudad}" when exactly those two filters name a
  // real taxonomy — the case the rule table canonicalises to /trabajo/X/Y, and
  // the one where a generic heading would describe the wrong page.
  const headingCategory = categories.find((c) => c.slug === filters.categoria);
  const headingCity = cities.find((c) => c.slug === filters.ciudad);
  const heading =
    headingCategory && headingCity
      ? `Empleos de ${headingCategory.name} en ${headingCity.name}`
      : headingCategory
        ? `Empleos de ${headingCategory.name} en Paraguay`
        : headingCity
          ? `Empleos en ${headingCity.name}`
          : 'Empleos en Paraguay';

  const currentFilters = {
    categoria: filters.categoria,
    ciudad: filters.ciudad,
    tipo: filters.tipo,
    nivel: filters.nivel,
    modalidad: param(sp, 'modalidad'),
    salario_min: param(sp, 'salario_min'),
    orden: param(sp, 'orden'),
    q: filters.q,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
        <Link href="/" className="hover:text-brand">Inicio</Link>
        <span aria-hidden="true">›</span>
        <span className="text-ink font-medium">Empleos</span>
      </nav>

      {/*
        The page finally says what it lists. There was no h1 at all: the
        breadcrumb, the filter panel and the result count between them never
        stated the subject, so the one element a crawler reads as the page's
        topic was missing from the site's most important listing URL.
      */}
      <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-6">{heading}</h1>

      {/*
        Suspense around every client component that reads useSearchParams. The
        route is dynamic today, so this is hygiene rather than a fix — but it is
        the difference between this page staying renderable if it is ever
        prerendered and the production build failing on it
        (node_modules/next/dist/docs .../use-search-params.md).
      */}
      <div className="mb-6">
        <Suspense fallback={<div className="h-[58px] rounded-[10px] border border-border bg-white" />}>
          <SearchBar initialQ={filters.q ?? ''} />
        </Suspense>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch lg:items-start">
        {/* Sidebar filters */}
        <Suspense fallback={null}>
          <FilterPanel
            categories={categories}
            cities={cities}
            currentFilters={currentFilters}
          />
        </Suspense>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={null}>
            <SortControl currentOrden={filters.orden ?? 'recientes'} total={total} />
          </Suspense>

          <ActiveFilters sp={sp} />

          <h2 className="sr-only">Resultados</h2>
          <div className="mt-4 space-y-3">
            {jobs.length === 0 ? (
              <EmptyResults sp={sp} />
            ) : (
              jobs.map((job) => <JobCard key={job.slug} job={job} />)
            )}
          </div>

          {/* Pagination — the component renders nothing on a single page. */}
          <Pagination
            basePath="/empleos"
            currentPage={filters.page ?? 1}
            totalPages={Math.ceil(total / JOBS_PAGE_SIZE)}
            searchParams={sp}
          />
        </div>
      </div>

      <TaxonomyLinks categories={categories} cities={cities} />
    </div>
  );
}

/**
 * The crawl path from the listing page down into the taxonomy tier.
 *
 * FilterPanel already offers these as filters, but it is a client component
 * that pushes query strings — so from a crawler's point of view /empleos linked
 * to nothing but its own permutations, and /trabajo/{categoria} was reachable
 * only from a job detail page. These are plain server-rendered anchors to the
 * indexable landings, which is the tier the filtered URLs above canonicalise
 * INTO: the rule table only works if the pages it points at can be found.
 *
 * Empty taxonomies are omitted rather than linked: a link to a landing that
 * noindexes itself for having no jobs is a crawl path to a dead end.
 */
function TaxonomyLinks({ categories, cities }: { categories: Category[]; cities: City[] }) {
  const withJobs = categories.filter((c) => (c.jobCount ?? 0) > 0);
  const citiesWithJobs = cities.filter((c) => (c.jobCount ?? 0) > 0);
  if (withJobs.length === 0 && citiesWithJobs.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-lg font-bold text-ink">Explorá por categoría</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {withJobs.map((cat) => (
          <li key={cat.slug}>
            <Link href={`/trabajo/${cat.slug}`} className={chipCls}>
              {cat.name}
              <span className="text-xs text-ink-3">{cat.jobCount}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold text-ink">Explorá por ciudad</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {citiesWithJobs.map((city) => (
          <li key={city.slug}>
            {/* S4 (PLAN-GROWTH.md §7 D7): the indexable city landing, not the
                self-noindexing ?ciudad= filter this used to point at. */}
            <Link href={`/trabajo-en/${city.slug}`} className={chipCls}>
              {city.name}
              <span className="text-xs text-ink-3">{city.jobCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const chipCls =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-white text-sm text-ink-secondary hover:border-brand hover:text-brand transition-colors';

// ---------------------------------------------------------------------------
// Active filters and the empty state (PLAN-GROWTH.md §4 D4).
//
// Both are server-rendered LINKS to the current URL minus one parameter, not
// client state: removing a filter is one tap on a phone without opening the
// drawer, it works before hydration, and a crawler can follow filter removal
// as well as filter addition. `page` is always dropped — page 3 of a wider
// result set is not where anyone expects to land.
// ---------------------------------------------------------------------------

/** The filter params a visitor can remove, in display order. */
const REMOVABLE = ['q', 'categoria', 'ciudad', 'tipo', 'nivel', 'modalidad', 'salario_min'] as const;
type Removable = (typeof REMOVABLE)[number];

function hrefWithout(sp: SearchParams, drop: readonly string[]): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value !== 'string' || !value || key === 'page' || drop.includes(key)) continue;
    next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/empleos?${qs}` : '/empleos';
}

function filterLabel(key: Removable, value: string): string {
  switch (key) {
    case 'q':
      return `"${value}"`;
    case 'categoria':
      return categoryLabel(value);
    case 'ciudad':
      return cityLabel(value);
    case 'tipo':
      return contractTypeLabel(value as ContractType) ?? value;
    case 'nivel':
      return seniorityLabel(value as Seniority) ?? value;
    case 'modalidad':
      return modalityLabel(value as Modality) ?? value;
    case 'salario_min': {
      const n = Number(value);
      return Number.isFinite(n) && n > 0
        ? `Desde Gs. ${new Intl.NumberFormat('es-PY').format(n)}`
        : value;
    }
  }
}

function ActiveFilters({ sp }: { sp: SearchParams }) {
  const active = REMOVABLE.flatMap((key) => {
    const value = param(sp, key);
    return value ? [{ key, value }] : [];
  });
  if (active.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      {active.map(({ key, value }) => (
        <Link
          key={key}
          href={hrefWithout(sp, [key])}
          className="inline-flex items-center gap-1.5 min-h-9 pl-3 pr-2 rounded-full bg-brand-tint text-brand text-sm font-medium border border-brand/20 hover:bg-brand hover:text-white transition-colors"
          aria-label={`Quitar filtro ${filterLabel(key, value)}`}
        >
          {filterLabel(key, value)}
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </Link>
      ))}
      {active.length > 1 && (
        <Link href={hrefWithout(sp, REMOVABLE)} className="text-sm font-medium text-ink-secondary hover:text-brand underline-offset-2 hover:underline px-1">
          Limpiar todo
        </Link>
      )}
    </div>
  );
}

/**
 * Zero results is where a seeker gives up, so this offers the three ways out
 * that are most likely to have jobs behind them — widen the place, widen the
 * field, drop the search words — as real links, most specific first.
 */
function EmptyResults({ sp }: { sp: SearchParams }) {
  const ciudad = param(sp, 'ciudad');
  const categoria = param(sp, 'categoria');
  const q = param(sp, 'q');
  const suggestions: { href: string; label: string }[] = [];
  if (ciudad) suggestions.push({ href: hrefWithout(sp, ['ciudad']), label: 'Buscar en todo Paraguay' });
  if (categoria) suggestions.push({ href: hrefWithout(sp, ['categoria']), label: 'Ver todas las categorías' });
  if (q) suggestions.push({ href: hrefWithout(sp, ['q']), label: `Quitar la búsqueda "${q}"` });
  suggestions.push({ href: '/empleos', label: 'Ver todos los empleos' });

  return (
    <div className="text-center py-12 px-6 bg-surface rounded-card border border-border">
      <h3 className="text-lg font-semibold text-ink">No hay empleos con estos filtros</h3>
      <p className="mt-1 text-sm text-ink-secondary">Probá ampliando la búsqueda:</p>
      <ul className="mt-5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-2">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex sm:inline-flex items-center justify-center min-h-11 px-4 rounded-[10px] border border-border-strong text-sm font-semibold text-ink hover:border-brand hover:text-brand"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
