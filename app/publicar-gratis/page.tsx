import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import { getCategories, getCities } from '@/lib/data';
import { getPlanPricing } from '@/lib/pricing';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import { INVOICE_NOTE, activePromo, formatGs, formatPromoEnd, promoDaysLeft } from '@/lib/plans';
import EmployerForm from '@/components/EmployerForm';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import { EmployerBenefits, PostVsListing } from '@/components/EmployerBenefits';

// The landing page for the free-publishing promotion (PLAN-GROWTH.md §16):
// where the site-wide promo bar, the homepage band and EmployerBand send an
// employer while Básico is free. It sells the benefits and ends in the same
// form /publicar uses, so a lead from here is an ordinary pending listing —
// the promotion changes the price, never the moderation path.
//
// It exists only while the promotion does. With no active Básico promotion
// there is nothing to sell here, so it hands off to /publicar instead of
// showing an offer that has ended. `noindex`: a campaign page that comes and
// goes must not compete with /publicar for the same searches.
export const revalidate = 300;

export const metadata: Metadata = {
  // "publicar empleos gratis" / "publicar trabajos gratis" wording, for Google
  // Ads relevance (docs/seo/KEYWORDS.md) — the page itself stays noindex.
  title: 'Publicar empleos gratis en Paraguay — promoción por tiempo limitado',
  description:
    'Por tiempo limitado, publicar tu aviso de empleo en trabajo.com.py es gratis: 30 días publicado, fácil de buscar por categoría y ciudad, postulaciones directo a tu WhatsApp.',
  alternates: { canonical: canonicalFor('/publicar-gratis') },
  robots: { index: false, follow: true },
};

export default async function PublicarGratisPage() {
  const [pricing, categories, cities] = await Promise.all([
    getPlanPricing(),
    getCategories(),
    getCities(),
  ]);
  const promo = activePromo(pricing.basico);
  if (!promo) redirect('/publicar');

  const until = formatPromoEnd(promo.endsAt);
  const days = promoDaysLeft(promo.endsAt);
  const free = promo.priceGs === 0;
  const offer = free ? 'gratis' : `a ${formatGs(promo.priceGs)}`;
  const selfServeEnabled = employerDashboardEnabled() && employerSignupEnabled();

  const ctaClass =
    'inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 rounded-[12px] bg-[#E6B25A] text-ink font-bold text-base hover:bg-[#d8a548] transition-colors';

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-white px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#E6B25A]">
            Promoción por tiempo limitado · {days === 1 ? 'Último día' : `Quedan ${days} días`}
          </p>
          <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.02em]">
            Publicá tu aviso de empleo {offer} hasta el {until}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/75 max-w-2xl mx-auto">
            Un aviso que queda publicado 30 días, que los postulantes pueden buscar y filtrar, y
            que les llega directo a tu WhatsApp. Después del {until}, publicar cuesta{' '}
            {formatGs(pricing.basico.priceGs)}.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#formulario" className={ctaClass}>
              {free ? 'Publicar mi aviso gratis' : 'Publicar mi aviso'}
            </a>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-[12px] border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Cómo funciona
            </a>
          </div>
          <p className="mt-4 text-sm text-white/60">
            Los avisos enviados antes del {until} quedan con la promoción sus 30 días completos.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Benefits */}
        <section className="py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-ink text-center">
            Por qué publicar en trabajo.com.py
          </h2>
          <p className="mt-3 text-center text-ink-secondary max-w-2xl mx-auto">
            Un portal de empleos, no un feed. Tu aviso está ordenado, se puede buscar y no compite
            con los mismos posteos repetidos todos los días.
          </p>
          <EmployerBenefits className="mt-8" />
        </section>

        {/* Post vs listing */}
        <section className="pb-14">
          <h2 className="text-2xl font-bold text-ink text-center mb-6">
            Un posteo en redes vs. un aviso en el portal
          </h2>
          <PostVsListing />
        </section>

        {/* How it works */}
        <section id="como-funciona" className="pb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-ink text-center mb-8">Cómo funciona</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ['Completá el formulario', 'El puesto, la ciudad, la descripción y tu WhatsApp de contacto.'],
              ['Revisamos tu aviso', `Nuestro equipo revisa cada aviso antes de publicarlo. ${WHATSAPP_HOURS_COPY}`],
              ['Se publica 30 días', 'Los postulantes lo encuentran y te escriben directo a tu WhatsApp.'],
            ].map(([title, body], i) => (
              <li key={title} className="bg-white rounded-[10px] border border-border p-5">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-brand text-white text-sm font-bold">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink-secondary leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The form */}
        <section id="formulario" className="pb-14 scroll-mt-24">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-[10px] border-2 border-brand/40 bg-brand-tint px-5 py-4 text-center mb-6">
              <p className="text-lg font-bold text-ink">
                {free ? 'Gratis' : formatGs(promo.priceGs)} hasta el {until}{' '}
                <span className="text-sm font-normal text-ink-secondary line-through">
                  {formatGs(pricing.basico.priceGs)}
                </span>
              </p>
              <p className="text-sm text-ink-secondary">
                {days === 1 ? 'Hoy es el último día de la promoción.' : `Quedan ${days} días de promoción.`}
              </p>
            </div>
            <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
              <h2 className="text-xl font-bold text-ink mb-6">Publicá tu aviso</h2>
              <EmployerForm categories={categories} cities={cities} />
              <p className="mt-6 text-center text-xs text-ink-secondary">
                Nuestro equipo revisa cada aviso antes de publicarlo. No publicamos datos de contacto
                de empleadores sin su consentimiento.
              </p>
            </div>
            {selfServeEnabled && (
              <p className="mt-4 text-center text-sm text-ink-secondary">
                ¿Vas a publicar seguido?{' '}
                <Link href="/empresa/registro" className="text-brand hover:underline font-medium">
                  Creá una cuenta de empresa
                </Link>{' '}
                y cargá tus avisos cuando quieras.
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-6">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {[
              {
                q: free ? '¿Es realmente gratis?' : '¿Cuánto cuesta?',
                a: free
                  ? `Sí. Hasta el ${until}, publicar un aviso Básico no tiene costo, y el aviso queda publicado sus 30 días completos.`
                  : `Hasta el ${until}, un aviso Básico cuesta ${formatGs(promo.priceGs)} en lugar de ${formatGs(pricing.basico.priceGs)}.`,
              },
              {
                q: `¿Qué pasa después del ${until}?`,
                a: `Los avisos enviados antes de esa fecha siguen con la promoción hasta cumplir sus 30 días. Los nuevos avisos cuestan ${formatGs(pricing.basico.priceGs)}.`,
              },
              {
                q: '¿Cuándo se publica mi aviso?',
                a: `Cuando nuestro equipo lo revisa y aprueba. ${WHATSAPP_HOURS_COPY}`,
              },
              {
                q: '¿Puedo destacar mi aviso?',
                a: `Sí. Con Destacado tu aviso aparece primero en los resultados y en la portada, por ${formatGs(pricing.destacado.priceGs)} por 30 días. ${INVOICE_NOTE}`,
              },
            ].map((item) => (
              <div key={item.q} className="bg-white rounded-[10px] border border-border p-5">
                <h3 className="font-semibold text-ink mb-2">{item.q}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <a href="#formulario" className={ctaClass}>
              {free ? 'Publicar mi aviso gratis' : 'Publicar mi aviso'}
            </a>
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/planes" className="text-brand hover:underline">
              Ver todos los planes
            </Link>
          </p>
        </section>
      </div>
      <FloatingWhatsApp />
    </>
  );
}
