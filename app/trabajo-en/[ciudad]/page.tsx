import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import { getJobs, getCity, getCities, getTaxonomyCounts } from '@/lib/data';
import { cityCopyFor } from '@/lib/seo/city-copy';
import { JOBS_PAGE_SIZE } from '@/lib/pagination';
import JobCard from '@/components/JobCard';
import Pagination from '@/components/Pagination';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type Params = Promise<{ ciudad: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The seven city slugs are static JSON — prerendering all of them at build
// is cheap (PLAN-GROWTH.md §4 S4).
export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((c) => ({ ciudad: c.slug }));
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
  const { ciudad } = await params;
  const page = pageFromSearchParams(await searchParams);
  const city = await getCity(ciudad);
  if (!city) return { title: 'Ciudad no encontrada' };

  const pageSuffix = page > 1 ? ` — página ${page}` : '';
  const canonicalPath = page > 1 ? `/trabajo-en/${ciudad}?page=${page}` : `/trabajo-en/${ciudad}`;

  return {
    title: `Trabajo en ${city.name} — empleos en ${city.name}, Paraguay${pageSuffix}`,
    description: `Encontrá empleos en ${city.name}, Paraguay. Postulate gratis en trabajo.com.py.`,
    robots: (city.jobCount ?? 0) === 0 ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: canonicalFor(canonicalPath) },
  };
}

export default async function CiudadPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { ciudad } = await params;
  const sp = await searchParams;
  const page = pageFromSearchParams(sp);

  const [city, { jobs, total }, taxonomyCounts] = await Promise.all([
    getCity(ciudad),
    getJobs({ ciudad, orden: 'recientes', page }),
    // Every category with a job in this city, not just the ones on this
    // page — same seam function S5 introduced for the category landings.
    getTaxonomyCounts({ ciudad }),
  ]);

  if (!city) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
      { '@type': 'ListItem', position: 3, name: city.name, item: `${siteUrl}/trabajo-en/${ciudad}` },
    ],
  };

  const itemListJsonLd = jobs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Empleos en ${city.name}`,
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/empleos/${job.slug}`,
      name: job.title,
    })),
  } : null;

  const categoriesWithJobs = taxonomyCounts.categories.filter((c) => (c.jobCount ?? 0) > 0);
  const intro = cityCopyFor(ciudad);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-brand">Inicio</Link>
          <span>›</span>
          <Link href="/empleos" className="hover:text-brand">Empleos</Link>
          <span>›</span>
          <span className="text-ink font-medium">{city.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-ink">Trabajo en {city.name}</h1>
          <p className="mt-3 text-base text-ink-secondary max-w-2xl">
            Explorá las {total > 0 ? total : 'últimas'} oportunidades laborales en {city.name}.
            Postulate gratis y encontrá el empleo ideal para vos.
          </p>
          {intro && <p className="mt-3 text-sm text-ink-secondary max-w-2xl">{intro}</p>}
        </div>

        {/* Category links for SEO */}
        {categoriesWithJobs.length > 0 && (
          <div className="mb-8 p-5 bg-white rounded-[10px] border border-border">
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
              Por categoría
            </h2>
            <div className="flex flex-wrap gap-2">
              {categoriesWithJobs.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/trabajo/${cat.slug}/${ciudad}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                >
                  {cat.name}
                  <span className="ml-1.5 text-xs text-ink-3">{cat.jobCount}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Jobs */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[10px] border border-border">
            <p className="text-ink-secondary">
              Todavía no hay empleos publicados en {city.name}.{' '}
              <Link href="/empleos" className="text-brand hover:underline">
                Ver todos los empleos
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            <Pagination
              basePath={`/trabajo-en/${ciudad}`}
              currentPage={page}
              totalPages={Math.ceil(total / JOBS_PAGE_SIZE)}
              searchParams={sp}
            />
          </>
        )}
      </div>
    </>
  );
}
