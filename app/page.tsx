import { getFeaturedJobs, getRecentJobs, getCategories, getCities } from '@/lib/data';
import SearchHero from '@/components/SearchHero';
import CategoryGrid from '@/components/CategoryGrid';
import JobCard from '@/components/JobCard';
import Link from 'next/link';
import { NandutiMotif } from '@/components/Logo';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

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
        <section className="py-12 px-4 bg-[#FBF3E0]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-[#1E1B17]">
                  <span className="text-[#B0812C]">★</span> Empleos destacados
                </h2>
                <p className="text-sm text-[#57514A] mt-1">Posiciones con mayor visibilidad</p>
              </div>
              <Link
                href="/empleos?orden=destacados"
                className="text-sm font-medium text-[#C0362A] hover:underline"
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
            <h2 className="text-2xl font-bold text-[#1E1B17]">Últimos empleos publicados</h2>
            <Link
              href="/empleos"
              className="text-sm font-medium text-[#C0362A] hover:underline"
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] border-2 border-[#C0362A] text-[#C0362A] font-semibold hover:bg-[#FBECE9] transition-colors"
            >
              Ver todos los empleos
            </Link>
          </div>
        </div>
      </section>

      {/* CTA for employers */}
      <section className="relative overflow-hidden bg-[#1E1B17] py-16 px-4">
        <NandutiMotif className="pointer-events-none absolute -right-20 -bottom-24 w-[24rem] h-[24rem] text-[#E6B25A] opacity-[0.12]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.02em] text-white">
            ¿Necesitás contratar?
          </h2>
          <p className="mt-3 text-white/70 text-base">
            Publicá tu empleo y recibí postulantes por WhatsApp en minutos.
          </p>
          <Link
            href="/publicar"
            className="mt-7 inline-flex items-center gap-2 px-8 py-3.5 rounded-[12px] bg-[#E6B25A] hover:bg-[#d8a548] text-[#1E1B17] font-bold text-base transition-colors"
          >
            Publicá tu empleo
          </Link>
        </div>
      </section>
    </>
  );
}
