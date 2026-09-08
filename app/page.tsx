import type { Metadata } from 'next';
import { getFeaturedJobs, getRecentJobs, getCategories, getCities } from '@/lib/data';
import { canonicalFor } from '@/lib/seo';
import { getLaunchPromoStatus } from '@/lib/promo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import SearchHero from '@/components/SearchHero';
import CategoryGrid from '@/components/CategoryGrid';
import JobCard from '@/components/JobCard';
import WhatsAppCta from '@/components/WhatsAppCta';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Link from 'next/link';
import { NandutiMotif } from '@/components/Logo';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

// The homepage inherited its title and description from app/layout.tsx and
// exported no metadata of its own, which meant it also had no canonical — and
// `/` is the one URL a site is most likely to be reached at under a second
// address (a preview host, a trailing-slash variant, a tracking parameter).
export const metadata: Metadata = {
  alternates: { canonical: canonicalFor('/') },
};

export default async function HomePage() {
  const [featured, recent, categories, cities, promo] = await Promise.all([
    getFeaturedJobs(6),
    getRecentJobs(8),
    getCategories(),
    getCities(),
    getLaunchPromoStatus(),
  ]);
  const promoActive = promo.enabled && promo.remaining > 0;

  return (
    <>
      <SearchHero cities={cities} />

      {/* Featured jobs */}
      {featured.length > 0 && (
        <section className="py-12 px-4 bg-[#FBF3E0]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-ink">
                  <span className="text-gold">★</span> Empleos destacados
                </h2>
                <p className="text-sm text-ink-secondary mt-1">Posiciones con mayor visibilidad</p>
              </div>
              <Link
                href="/empleos?orden=destacados"
                className="text-sm font-medium text-brand hover:underline"
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
            <h2 className="text-2xl font-bold text-ink">Últimos empleos publicados</h2>
            <Link
              href="/empleos"
              className="text-sm font-medium text-brand hover:underline"
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] border-2 border-brand text-brand font-semibold hover:bg-brand-tint transition-colors"
            >
              Ver todos los empleos
            </Link>
          </div>
        </div>
      </section>

      {/* CTA for employers */}
      <section className="relative overflow-hidden bg-ink py-16 px-4">
        <NandutiMotif className="pointer-events-none absolute -right-20 -bottom-24 w-[24rem] h-[24rem] text-[#E6B25A] opacity-[0.12]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.02em] text-white">
            ¿Necesitás contratar?
          </h2>
          <p className="mt-3 text-white/70 text-base">
            Publicá tu empleo gratis. Los postulantes te escriben directo a tu WhatsApp.
          </p>
          {promoActive && (
            <p className="mt-2 text-[#E6B25A] text-sm font-semibold">
              Promoción de lanzamiento: los primeros 100 avisos salen destacados 90 días, gratis.
              Quedan {promo.remaining}.
            </p>
          )}
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <WhatsAppCta
              intent="publicar"
              promoActive={promoActive}
              sourcePage="/"
              className="sm:w-auto sm:px-8"
            />
            <Link
              href="/publicar"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-[12px] border-2 border-white/30 text-white font-semibold text-base hover:bg-white/10 transition-colors"
            >
              Publicar con el formulario
            </Link>
          </div>
          <p className="mt-4">
            <Link href="/planes" className="text-sm text-white/70 hover:text-white hover:underline">
              Ver planes y precios
            </Link>
          </p>
          <p className="mt-3 text-xs text-white/50">{WHATSAPP_HOURS_COPY}</p>
        </div>
      </section>

      <FloatingWhatsApp />
    </>
  );
}
