import { getFeaturedJobs, getRecentJobs, getCategories, getCities } from '@/lib/data';
import SearchHero from '@/components/SearchHero';
import CategoryGrid from '@/components/CategoryGrid';
import JobCard from '@/components/JobCard';
import Link from 'next/link';

export const revalidate = 60;

export default async function HomePage() {
  const [featured, recent, categories, cities] = await Promise.all([
    getFeaturedJobs(6),
    getRecentJobs(8),
    getCategories(),
    getCities(),
  ]);

  return (
    <>
      <SearchHero cities={cities} />

      {/* Featured jobs */}
      {featured.length > 0 && (
        <section className="py-12 px-4 bg-[#FDF4E3]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#16181D]">Empleos destacados</h2>
                <p className="text-sm text-[#5B6472] mt-1">Posiciones con mayor visibilidad</p>
              </div>
              <Link
                href="/empleos?orden=destacados"
                className="text-sm font-medium text-[#2557D6] hover:underline"
              >
                Ver todos →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featured.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <CategoryGrid categories={categories} />

      {/* Recent jobs */}
      <section className="py-8 px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#16181D]">Últimos empleos publicados</h2>
            <Link
              href="/empleos"
              className="text-sm font-medium text-[#2557D6] hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recent.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/empleos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] border-2 border-[#2557D6] text-[#2557D6] font-semibold hover:bg-[#EEF3FE] transition-colors"
            >
              Ver todos los empleos
            </Link>
          </div>
        </div>
      </section>

      {/* CTA for employers */}
      <section className="bg-[#16181D] py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            ¿Necesitás contratar?
          </h2>
          <p className="mt-3 text-[#9CA3AF] text-base">
            Publicá tu empleo gratis y encontrá al candidato ideal. Nuestro equipo te ayuda.
          </p>
          <Link
            href="/publicar"
            className="mt-6 inline-flex items-center gap-2 px-8 py-3.5 rounded-[10px] bg-[#2557D6] hover:bg-[#1E47B8] text-white font-semibold text-base transition-colors"
          >
            Publicá tu empleo gratis
          </Link>
        </div>
      </section>
    </>
  );
}
