import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canonicalFor } from '@/lib/seo';
import Link from 'next/link';
import { getJobs, getCategory, getCity, getCategories, getCities, getTaxonomyCounts } from '@/lib/data';
import { categoryCopyFor } from '@/lib/seo/category-copy';
import { categoryLabel } from '@/lib/labels';
import { JOBS_PAGE_SIZE } from '@/lib/pagination';
import JobCard from '@/components/JobCard';
import Pagination from '@/components/Pagination';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type Params = Promise<{ categoria: string; ciudad: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Every categoría × ciudad combination, not just the ones with jobs today —
// an empty combo is cheap to prerender and already noindexes itself
// (§3.6: "10 + up to 70 pages render cold" without this).
export async function generateStaticParams() {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  return categories.flatMap((cat) => cities.map((city) => ({ categoria: cat.slug, ciudad: city.slug })));
}

function pageFromSearchParams(sp: Awaited<SearchParams>): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { categoria, ciudad } = await params;
  const page = pageFromSearchParams(await searchParams);
  const [category, city, taxonomyCounts] = await Promise.all([
    getCategory(categoria),
    getCity(ciudad),
    getTaxonomyCounts({ categoria }),
  ]);
  if (!category || !city) return { title: 'Página no encontrada' };

  // Reuses the same seam call the page body makes for its "Otras ciudades"
  // cross-link, instead of a second getJobs() just to decide robots (§3.6).
  const hasJobs = (taxonomyCounts.cities.find((c) => c.slug === ciudad)?.jobCount ?? 0) > 0;

  const pageSuffix = page > 1 ? ` — página ${page}` : '';
  const canonicalPath =
    page > 1 ? `/trabajo/${categoria}/${ciudad}?page=${page}` : `/trabajo/${categoria}/${ciudad}`;

  return {
    title: `Trabajo de ${category.name} en ${city.name}${pageSuffix}`,
    description: `Encontrá empleos de ${category.name} en ${city.name}, Paraguay. Postulate gratis en trabajo.com.py`,
    robots: hasJobs ? { index: true, follow: true } : { index: false, follow: true },
    // This URL is what /empleos?categoria=X&ciudad=Y canonicalises to
    // (lib/seo.ts), so it has to name itself — a target that does not declare
    // its own canonical leaves the pair pointing at each other loosely.
    alternates: { canonical: canonicalFor(canonicalPath) },
  };
}

export default async function CategoriaciudadPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { categoria, ciudad } = await params;
  const sp = await searchParams;
  const page = pageFromSearchParams(sp);

  const [category, city, { jobs, total }, taxonomyCounts] = await Promise.all([
    getCategory(categoria),
    getCity(ciudad),
    getJobs({ categoria, ciudad, orden: 'recientes', page }),
    // Sibling cities for "Otras ciudades" — every city with a job in this
    // category, same seam S5 adds for the parent category page.
    getTaxonomyCounts({ categoria }),
  ]);

  if (!category || !city) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${siteUrl}/trabajo/${categoria}` },
      { '@type': 'ListItem', position: 4, name: city.name, item: `${siteUrl}/trabajo/${categoria}/${ciudad}` },
    ],
  };

  const itemListJsonLd = jobs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Empleos de ${category.name} en ${city.name}`,
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/empleos/${job.slug}`,
      name: job.title,
    })),
  } : null;

  const otherCities = taxonomyCounts.cities.filter(
    (c) => (c.jobCount ?? 0) > 0 && c.slug !== ciudad,
  );
  const copy = categoryCopyFor(categoria);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6 flex-wrap" aria-label="Ruta">
          <Link href="/" className="hover:text-brand">Inicio</Link>
          <span>›</span>
          <Link href="/empleos" className="hover:text-brand">Empleos</Link>
          <span>›</span>
          <Link href={`/trabajo/${categoria}`} className="hover:text-brand">{category.name}</Link>
          <span>›</span>
          <span className="text-ink font-medium">{city.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-ink">
            Trabajo de {category.name} en {city.name}
          </h1>
          <p className="mt-3 text-base text-ink-secondary max-w-2xl">
            {total > 0
              ? `${total} ${total === 1 ? 'empleo disponible' : 'empleos disponibles'} en ${category.name} en ${city.name}. Postulate gratis y encontrá el trabajo ideal.`
              : `Todavía no hay empleos de ${category.name} publicados en ${city.name}.`}
          </p>
        </div>

        {/* Jobs or empty state */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[10px] border border-border">
            <p className="text-ink-secondary mb-4">
              No hay empleos disponibles en esta ubicación por el momento.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/trabajo/${categoria}`}
                className="px-5 py-2.5 rounded-[10px] border-2 border-brand text-brand font-medium text-sm hover:bg-brand-tint transition-colors"
              >
                Ver {category.name} en todo el país
              </Link>
              <Link
                href="/empleos"
                className="px-5 py-2.5 rounded-[10px] bg-brand text-white font-medium text-sm hover:bg-brand-hover transition-colors"
              >
                Ver todos los empleos
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            <Pagination
              basePath={`/trabajo/${categoria}/${ciudad}`}
              currentPage={page}
              totalPages={Math.ceil(total / JOBS_PAGE_SIZE)}
              searchParams={sp}
            />
          </>
        )}

        {/* Cross-links (PLAN-GROWTH.md §4 S5) */}
        {(otherCities.length > 0 || (copy && copy.related.length > 0)) && (
          <div className="mt-10 pt-8 border-t border-border space-y-8">
            {otherCities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
                  Otras ciudades
                </h2>
                <div className="flex flex-wrap gap-2">
                  {otherCities.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/trabajo/${categoria}/${c.slug}`}
                      className="px-3 py-1.5 rounded-full text-sm border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                    >
                      {c.name}
                      <span className="ml-1.5 text-xs text-ink-3">{c.jobCount}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {copy && copy.related.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
                  Categorías relacionadas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {copy.related.map((slug) => (
                    <Link
                      key={slug}
                      href={`/trabajo/${slug}/${ciudad}`}
                      className="px-3 py-1.5 rounded-full text-sm border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                    >
                      {categoryLabel(slug)} en {city.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
