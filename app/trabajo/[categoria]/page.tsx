import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getJobs, getCategory, getCities } from '@/lib/data';
import JobCard from '@/components/JobCard';

export const revalidate = 60;

type Params = Promise<{ categoria: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categoria } = await params;
  const category = await getCategory(categoria);
  if (!category) return { title: 'Categoría no encontrada' };

  return {
    title: `Trabajo de ${category.name.toLowerCase()} en Paraguay`,
    description: `Encontrá los mejores empleos de ${category.name.toLowerCase()} en Paraguay. Postulate gratis en trabajo.com.py`,
    robots: category.jobCount === 0 ? { index: false } : { index: true, follow: true },
  };
}

export default async function CategoriaPage({ params }: { params: Params }) {
  const { categoria } = await params;
  const [category, { jobs }, cities] = await Promise.all([
    getCategory(categoria),
    getJobs({ categoria, orden: 'recientes' }),
    getCities(),
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

  // Filter cities that have jobs in this category
  const citiesWithJobs = cities.filter((city) =>
    jobs.some((j) => j.citySlug === city.slug)
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#5B6472] mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-[#2557D6]">Inicio</Link>
          <span>›</span>
          <Link href="/empleos" className="hover:text-[#2557D6]">Empleos</Link>
          <span>›</span>
          <span className="text-[#16181D] font-medium">{category.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#16181D]">
            Trabajo de {category.name.toLowerCase()} en Paraguay
          </h1>
          <p className="mt-3 text-base text-[#5B6472] max-w-2xl">
            Explorá las {jobs.length > 0 ? jobs.length : 'últimas'} oportunidades laborales en{' '}
            {category.name.toLowerCase()} disponibles en todo el Paraguay.
            Postulate gratis y encontrá el empleo ideal para vos.
          </p>
        </div>

        {/* City links for SEO */}
        {citiesWithJobs.length > 0 && (
          <div className="mb-8 p-5 bg-white rounded-[10px] border border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#5B6472] uppercase tracking-wide mb-3">
              Por ciudad
            </h2>
            <div className="flex flex-wrap gap-2">
              {citiesWithJobs.map((city) => (
                <Link
                  key={city.slug}
                  href={`/trabajo/${categoria}/${city.slug}`}
                  className="px-3 py-1.5 rounded-full text-sm border border-[#E5E7EB] text-[#5B6472] hover:border-[#2557D6] hover:text-[#2557D6] transition-colors"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Jobs */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[10px] border border-[#E5E7EB]">
            <p className="text-[#5B6472]">
              Todavía no hay empleos publicados en esta categoría.{' '}
              <Link href="/empleos" className="text-[#2557D6] hover:underline">
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
            <div className="mt-8 text-center">
              <Link
                href={`/empleos?categoria=${categoria}`}
                className="text-sm font-medium text-[#2557D6] hover:underline"
              >
                Ver todos los empleos de {category.name.toLowerCase()} →
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
