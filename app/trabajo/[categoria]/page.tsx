import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canonicalFor } from '@/lib/seo';
import Link from 'next/link';
import { getJobs, getCategory, getCategories, getTaxonomyCounts } from '@/lib/data';
import { categoryCopyFor } from '@/lib/seo/category-copy';
import { categoryLabel } from '@/lib/labels';
import { JOBS_PAGE_SIZE } from '@/lib/pagination';
import JobCard from '@/components/JobCard';
import Pagination from '@/components/Pagination';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type Params = Promise<{ categoria: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The ten category slugs are static JSON — prerendering all of them at build
// is cheap, and it is what turns this route from cold-on-first-hit (§3.6)
// into a page that exists before the first visitor asks for it.
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ categoria: c.slug }));
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
  const { categoria } = await params;
  const page = pageFromSearchParams(await searchParams);
  const category = await getCategory(categoria);
  if (!category) return { title: 'Categoría no encontrada' };

  const pageSuffix = page > 1 ? ` — página ${page}` : '';
  // Page 1 is the bare URL, same convention as /empleos and Pagination's own
  // rule: one canonical form for the first page, `?page=N` for the rest.
  const canonicalPath = page > 1 ? `/trabajo/${categoria}?page=${page}` : `/trabajo/${categoria}`;

  return {
    title: `Trabajo de ${category.name} en Paraguay${pageSuffix}`,
    description: `Encontrá los mejores empleos de ${category.name} en Paraguay. Postulate gratis en trabajo.com.py`,
    robots:
      category.jobCount === 0 ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: canonicalFor(canonicalPath) },
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { categoria } = await params;
  const sp = await searchParams;
  const page = pageFromSearchParams(sp);

  const [category, { jobs, total }, taxonomyCounts] = await Promise.all([
    getCategory(categoria),
    getJobs({ categoria, orden: 'recientes', page }),
    // Every city with a job in this category, not just the ones on this
    // page — the seam function S5 adds specifically to fix that (§3.6).
    getTaxonomyCounts({ categoria }),
  ]);

  if (!category) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${siteUrl}/trabajo/${categoria}` },
    ],
  };

  const itemListJsonLd = jobs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Empleos de ${category.name} en Paraguay`,
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/empleos/${job.slug}`,
      name: job.title,
    })),
  } : null;

  const citiesWithJobs = taxonomyCounts.cities.filter((c) => (c.jobCount ?? 0) > 0);
  const copy = categoryCopyFor(categoria);

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
          <span className="text-ink font-medium">{category.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-ink">
            Trabajo de {category.name} en Paraguay
          </h1>
          <p className="mt-3 text-base text-ink-secondary max-w-2xl">
            Explorá las {total > 0 ? total : 'últimas'} oportunidades laborales en{' '}
            {category.name} disponibles en todo el Paraguay.
            Postulate gratis y encontrá el empleo ideal para vos.
          </p>
          {copy && <p className="mt-3 text-sm text-ink-secondary max-w-2xl">{copy.intro}</p>}
        </div>

        {/* City links for SEO */}
        {citiesWithJobs.length > 0 && (
          <div className="mb-8 p-5 bg-white rounded-[10px] border border-border">
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
              Por ciudad
            </h2>
            <div className="flex flex-wrap gap-2">
              {citiesWithJobs.map((city) => (
                <Link
                  key={city.slug}
                  href={`/trabajo/${categoria}/${city.slug}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                >
                  {city.name}
                  <span className="ml-1.5 text-xs text-ink-3">{city.jobCount}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Jobs */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[10px] border border-border">
            <p className="text-ink-secondary">
              Todavía no hay empleos publicados en esta categoría.{' '}
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
              basePath={`/trabajo/${categoria}`}
              currentPage={page}
              totalPages={Math.ceil(total / JOBS_PAGE_SIZE)}
              searchParams={sp}
            />
          </>
        )}

        {/* Cross-links (PLAN-GROWTH.md §4 S5) */}
        {copy && copy.related.length > 0 && (
          <section className="mt-10 pt-8 border-t border-border">
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
              Categorías relacionadas
            </h2>
            <div className="flex flex-wrap gap-2">
              {copy.related.map((slug) => (
                <Link
                  key={slug}
                  href={`/trabajo/${slug}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                >
                  {categoryLabel(slug)}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
