import type { Metadata } from 'next';
import { getFeaturedJobs, getRecentJobs, getCategories, getCities } from '@/lib/data';
import { canonicalFor, siteUrl } from '@/lib/seo';
import { getLaunchPromoStatus } from '@/lib/promo';
import { getPlanPricing } from '@/lib/pricing';
import { activePromo, formatGs, formatPrice, formatPromoEnd } from '@/lib/plans';
import { WHATSAPP_HOURS_COPY, siteWhatsAppNumber } from '@/lib/whatsapp';
import SearchHero from '@/components/SearchHero';
import CategoryGrid from '@/components/CategoryGrid';
import JobCard from '@/components/JobCard';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Link from 'next/link';
import { NandutiMotif } from '@/components/Logo';
import JsonLd from '@/components/JsonLd';
import BlogPostLinks from '@/components/BlogPostLinks';
import { getLatestBlogPosts } from '@/lib/blog';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

// The homepage inherited its title and description from app/layout.tsx and
// exported no metadata of its own, which meant it also had no canonical — and
// `/` is the one URL a site is most likely to be reached at under a second
// address (a preview host, a trailing-slash variant, a tracking parameter).
export const metadata: Metadata = {
  // "empleos py" (14.800/mes) and "bolsa de trabajo paraguay" (8.100/mes) are
  // the two biggest searches in docs/seo/keywords-2026-09-27.csv; the title
  // carries both verbatim. Absolute rather than templated: this page sits in
  // the root segment, where the layout's "%s | trabajo.com.py" does not apply.
  title: 'Empleos PY — Bolsa de trabajo en Paraguay | trabajo.com.py',
  description:
    'Bolsa de trabajo en Paraguay: ofertas laborales en Asunción, Ciudad del Este, Encarnación y todo el país. Buscá por categoría y ciudad, y postulate gratis por WhatsApp.',
  alternates: { canonical: canonicalFor('/') },
};

export default async function HomePage() {
  const [featured, recent, categories, cities, promo, pricing, latestPosts] = await Promise.all([
    getFeaturedJobs(6),
    getRecentJobs(6),
    getCategories(),
    getCities(),
    getLaunchPromoStatus(),
    getPlanPricing(),
    getLatestBlogPosts(3),
  ]);
  const promoActive = promo.enabled && promo.remaining > 0;
  const basicoPromo = activePromo(pricing.basico);
  // Every live listing has exactly one category, so the category counts
  // already sum to the catalogue size — no extra query for the trust line.
  const activeJobCount = categories.reduce((n, c) => n + (c.jobCount ?? 0), 0);

  const site = siteUrl();
  const waNumber = siteWhatsAppNumber();
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'trabajo.com.py',
    url: site,
    logo: `${site}/icon.svg`,
    // No `sameAs` (owner decision D9): WhatsApp is the only contact channel,
    // and there are no social profiles to point at.
    ...(waNumber
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: waNumber.startsWith('+') ? waNumber : `+${waNumber}`,
            contactType: 'sales',
          },
        }
      : {}),
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'trabajo.com.py',
    url: site,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${site}/empleos?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <SearchHero
        cities={cities}
        activeJobCount={activeJobCount}
        activeCityCount={cities.filter((c) => (c.jobCount ?? 0) > 0).length}
      />

      {/* Recent jobs first (PLAN-GROWTH.md §4 D3): freshness is the seeker's
          signal and the reason they came. On a phone the first of these now
          starts on the first screen. */}
      <section className="pt-8 pb-4 sm:pt-12 px-4" aria-labelledby="recientes">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 mb-4 sm:mb-6">
            <h2 id="recientes" className="text-xl sm:text-2xl font-bold text-ink">Últimos empleos</h2>
            <Link href="/empleos" className="text-sm font-medium text-brand hover:underline whitespace-nowrap">
              Ver todos <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {recent.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
          <div className="mt-6 sm:mt-8 text-center">
            <Link
              href="/empleos"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-6 rounded-[12px] bg-ink text-white font-semibold hover:bg-ink/90 transition-colors"
            >
              Ver {activeJobCount > 0 ? `los ${activeJobCount} empleos` : 'todos los empleos'}
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <CategoryGrid categories={categories} />

      {/* Cities (PLAN-GROWTH.md §4 S4) */}
      {cities.some((c) => (c.jobCount ?? 0) > 0) && (
        <section className="pb-10 sm:pb-12 px-4" aria-labelledby="ciudades">
          <div className="max-w-7xl mx-auto">
            <h2 id="ciudades" className="text-xl sm:text-2xl font-bold text-ink mb-4 sm:mb-6">Empleos por ciudad</h2>
            <div className="flex flex-wrap gap-2">
              {cities
                .filter((c) => (c.jobCount ?? 0) > 0)
                .map((city) => (
                  <Link
                    key={city.slug}
                    href={`/trabajo-en/${city.slug}`}
                    className="inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full border border-border bg-surface text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                  >
                    {city.name}
                    <span className="text-xs font-semibold text-ink-3 tabular-nums">{city.jobCount}</span>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* The one block of plain text on the homepage, for the searches it
          targets (docs/seo/KEYWORDS.md): "bolsa de trabajo paraguay", "empleos
          py", "ofertas laborales en paraguay", and one internal link per city
          landing with "bolsa de trabajo en {ciudad}" as its anchor. */}
      <section className="pb-10 sm:pb-12 px-4" aria-labelledby="bolsa">
        <div className="max-w-7xl mx-auto">
          <h2 id="bolsa" className="text-xl sm:text-2xl font-bold text-ink">
            Bolsa de trabajo en Paraguay
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-secondary max-w-3xl leading-relaxed">
            trabajo.com.py es la bolsa de trabajo de Paraguay hecha para el celular: ofertas
            laborales en Asunción, Ciudad del Este, Encarnación y todo el país, ordenadas por
            categoría y ciudad. Buscá, filtrá y postulate gratis, directo al WhatsApp de la empresa.
            Cada aviso lo revisa nuestro equipo antes de publicarse.
          </p>
          {cities.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {cities
                .filter((c) => (c.jobCount ?? 0) > 0)
                .map((city) => (
                  <li key={city.slug}>
                    <Link href={`/trabajo-en/${city.slug}`} className="text-brand hover:underline">
                      Bolsa de trabajo en {city.name}
                    </Link>
                  </li>
                ))}
              <li>
                <Link href="/empleos" className="text-brand hover:underline">
                  Todas las ofertas laborales
                </Link>
              </li>
              <li>
                <Link href="/buscar-personal" className="text-brand hover:underline">
                  ¿Buscás personal?
                </Link>
              </li>
            </ul>
          )}
        </div>
      </section>

      {/* Featured jobs — a paid slot, so below what the seeker came for
          (§7 D10), and still on the homepage, as /planes promises
          ("Posición destacada en resultados y portada"). */}
      {featured.length > 0 && (
        <section className="py-10 sm:py-12 px-4 bg-[#FBF3E0]" aria-labelledby="destacados">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-baseline justify-between gap-4 mb-4 sm:mb-6">
              <div>
                <h2 id="destacados" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-ink">
                  <span className="text-gold" aria-hidden="true">★</span> Empleos destacados
                </h2>
                <p className="text-sm text-ink-secondary mt-1">Empresas que están contratando ahora</p>
              </div>
              <Link href="/empleos" className="text-sm font-medium text-brand hover:underline whitespace-nowrap">
                Ver todos <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {featured.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Blog (PLAN-GROWTH.md §4 C2 / D3 order): after the paid slot, before
          the employer band. Absent until something is published. */}
      {latestPosts.length > 0 && (
        <div className="py-10 sm:py-12 px-4">
          <BlogPostLinks
            title="Consejos para conseguir trabajo"
            posts={latestPosts}
            moreHref="/blog"
            moreLabel="Ver el blog"
            className="max-w-7xl mx-auto"
          />
        </div>
      )}

      {/* CTA for employers */}
      <section className="relative overflow-hidden bg-ink py-12 sm:py-16 px-4">
        <NandutiMotif className="pointer-events-none absolute -right-20 -bottom-24 w-[24rem] h-[24rem] text-[#E6B25A] opacity-[0.12]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.02em] text-white">
            ¿Necesitás contratar?
          </h2>
          <p className="mt-3 text-white/70 text-base">
            {basicoPromo?.priceGs === 0
              ? 'Publicá tu empleo gratis. Los postulantes te escriben directo a tu WhatsApp.'
              : 'Publicá tu empleo. Los postulantes te escriben directo a tu WhatsApp.'}
          </p>
          {basicoPromo && (
            <p className="mt-2 text-white text-sm font-semibold">
              Promoción por tiempo limitado: {formatPrice(basicoPromo.priceGs).toLowerCase()} hasta
              el {formatPromoEnd(basicoPromo.endsAt)}. Después, {formatGs(pricing.basico.priceGs)} por
              aviso.
            </p>
          )}
          {promoActive && (
            <p className="mt-2 text-[#E6B25A] text-sm font-semibold">
              Promoción de lanzamiento: los primeros 100 avisos salen destacados 90 días, gratis.
              Quedan {promo.remaining}.
            </p>
          )}
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={basicoPromo ? '/publicar-gratis' : '/publicar'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-[12px] bg-[#E6B25A] text-ink font-bold text-base hover:bg-[#d8a548] transition-colors"
            >
              {basicoPromo?.priceGs === 0 ? 'Publicá gratis ahora' : 'Publicá tu empleo'}
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
