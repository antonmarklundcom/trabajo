import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getJobs, getCategory, getCity } from '@/lib/data';
import JobCard from '@/components/JobCard';

export const revalidate = 60;

type Params = Promise<{ categoria: string; ciudad: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categoria, ciudad } = await params;
  const [category, city] = await Promise.all([getCategory(categoria), getCity(ciudad)]);
  if (!category || !city) return { title: 'Página no encontrada' };

  const { total } = await getJobs({ categoria, ciudad });
  const hasJobs = total > 0;

  return {
    title: `Trabajo de ${category.name.toLowerCase()} en ${city.name}`,
    description: `Encontrá empleos de ${category.name.toLowerCase()} en ${city.name}, Paraguay. Postulate gratis en trabajo.com.py`,
    robots: hasJobs ? { index: true, follow: true } : { index: false },
  };
}

export default async function CategoriaciudadPage({ params }: { params: Params }) {
  const { categoria, ciudad } = await params;
  const [category, city, { jobs }] = await Promise.all([
    getCategory(categoria),
    getCity(ciudad),
    getJobs({ categoria, ciudad, orden: 'recientes' }),
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#5B6472] mb-6 flex-wrap" aria-label="Ruta">
          <Link href="/" className="hover:text-[#2557D6]">Inicio</Link>
          <span>›</span>
          <Link href="/empleos" className="hover:text-[#2557D6]">Empleos</Link>
          <span>›</span>
          <Link href={`/trabajo/${categoria}`} className="hover:text-[#2557D6]">{category.name}</Link>
          <span>›</span>
          <span className="text-[#16181D] font-medium">{city.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#16181D]">
            Trabajo de {category.name.toLowerCase()} en {city.name}
          </h1>
          <p className="mt-3 text-base text-[#5B6472] max-w-2xl">
            {jobs.length > 0
              ? `${jobs.length} ${jobs.length === 1 ? 'empleo disponible' : 'empleos disponibles'} en ${category.name.toLowerCase()} en ${city.name}. Postulate gratis y encontrá el trabajo ideal.`
              : `Todavía no hay empleos de ${category.name.toLowerCase()} publicados en ${city.name}.`}
          </p>
        </div>

        {/* Jobs or empty state */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[10px] border border-[#E5E7EB]">
            <p className="text-[#5B6472] mb-4">
              No hay empleos disponibles en esta ubicación por el momento.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/trabajo/${categoria}`}
                className="px-5 py-2.5 rounded-[10px] border-2 border-[#2557D6] text-[#2557D6] font-medium text-sm hover:bg-[#EEF3FE] transition-colors"
              >
                Ver {category.name.toLowerCase()} en todo el país
              </Link>
              <Link
                href="/empleos"
                className="px-5 py-2.5 rounded-[10px] bg-[#2557D6] text-white font-medium text-sm hover:bg-[#1E47B8] transition-colors"
              >
                Ver todos los empleos
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
