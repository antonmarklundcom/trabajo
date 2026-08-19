import type { Metadata } from 'next';
import Link from 'next/link';
import { getJobs, getCategories, getCities } from '@/lib/data';
import type { JobFilters } from '@/lib/types';
import JobCard from '@/components/JobCard';
import FilterPanel from '@/components/FilterPanel';
import SortControl from '@/components/SortControl';
import SearchBar from '@/components/SearchBar';

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const ciudad = param(sp, 'ciudad');
  const title = q
    ? `Empleos de "${q}"${ciudad ? ` en ${ciudad}` : ''}`
    : 'Todos los empleos en Paraguay';
  return {
    title,
    description: `Buscá empleos en Paraguay. Filtrá por categoría, ciudad, modalidad y más.`,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
    ],
  };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#57514A] mb-6" aria-label="Ruta">
        <Link href="/" className="hover:text-[#C0362A]">Inicio</Link>
        <span aria-hidden="true">›</span>
        <span className="text-[#1E1B17] font-medium">Empleos</span>
      </nav>

      {/* Search bar */}
      <div className="mb-6">
        <SearchBar initialQ={filters.q ?? ''} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch lg:items-start">
        {/* Sidebar filters */}
        <FilterPanel
          categories={categories}
          cities={cities}
          currentFilters={currentFilters}
        />

        {/* Results */}
        <div className="flex-1 min-w-0">
          <SortControl currentOrden={filters.orden ?? 'recientes'} total={total} />

          <div className="mt-4 space-y-3">
            {jobs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[10px] border border-[#E7E1D6]">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-[#1E1B17] mb-2">
                  No encontramos empleos con esos filtros
                </h3>
                <p className="text-sm text-[#57514A]">
                  Intentá con otros criterios o{' '}
                  <Link href="/empleos" className="text-[#C0362A] hover:underline">
                    ver todos los empleos
                  </Link>
                  .
                </p>
              </div>
            ) : (
              jobs.map((job) => <JobCard key={job.slug} job={job} />)
            )}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <Pagination
              currentPage={filters.page ?? 1}
              total={total}
              pageSize={20}
              searchParams={sp}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  total,
  pageSize,
  searchParams,
}: {
  currentPage: number;
  total: number;
  pageSize: number;
  searchParams: SearchParams;
}) {
  const totalPages = Math.ceil(total / pageSize);

  function pageUrl(page: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === 'string') params.set(k, v);
    }
    params.set('page', String(page));
    return `/empleos?${params.toString()}`;
  }

  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <a
          href={pageUrl(currentPage - 1)}
          className="px-4 py-2 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#1E1B17] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
        >
          ← Anterior
        </a>
      )}
      <span className="text-sm text-[#57514A]">
        Página {currentPage} de {totalPages}
      </span>
      {currentPage < totalPages && (
        <a
          href={pageUrl(currentPage + 1)}
          className="px-4 py-2 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#1E1B17] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
        >
          Siguiente →
        </a>
      )}
    </div>
  );
}
