import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY, siteWhatsAppNumber } from '@/lib/whatsapp';
import { getCategories, getCities } from '@/lib/data';
import { getPlanPricing } from '@/lib/pricing';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import {
  INVOICE_NOTE,
  activePromo,
  formatGs,
  formatPromoEnd,
  promoDaysLeft,
  type ActivePromo,
  type PlanPricingTable,
} from '@/lib/plans';
import EmployerForm from '@/components/EmployerForm';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import WhatsAppCta from '@/components/WhatsAppCta';
import { EmployerBenefits, PostVsListing } from '@/components/EmployerBenefits';

// "Publicar empleos gratis" — the promotion page, and a PERMANENT URL
// (PLAN-GROWTH.md §16, §18). Two states, one address:
//
//   - While the Básico promotion runs it sells it: the real deadline, the
//     after-price, the benefits, and the same moderated EmployerForm /publicar
//     uses (a lead from here is an ordinary pending listing — the promotion
//     changes the price, never the moderation path).
//   - With no promotion it says so in its first line — "Hoy no hay una
//     promoción activa" — states today's price, and offers to announce the
//     next one. It never implies publishing is free when it is not; the word
//     "gratis" stays in the title because that is what people search for, and
//     the page answers that search honestly.
//
// Permanent and indexed so whatever it ranks for ("publicar empleos gratis",
// "páginas para publicar empleos gratis", docs/seo/KEYWORDS.md) is not thrown
// away every time a promotion ends.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const promo = activePromo((await getPlanPricing()).basico);
  const free = promo?.priceGs === 0;
  return {
    title: promo
      ? `Publicar empleos gratis en Paraguay — promoción hasta el ${formatPromoEnd(promo.endsAt)}`
      : 'Publicar empleos gratis en Paraguay: promociones y precios',
    description: promo
      ? `Por tiempo limitado, publicar tu aviso de empleo en trabajo.com.py ${free ? 'es gratis' : `cuesta ${formatGs(promo.priceGs)}`}: 30 días publicado, fácil de buscar por categoría y ciudad, postulaciones directo a tu WhatsApp.`
      : 'Cuándo se puede publicar empleos gratis en trabajo.com.py, cuánto cuesta hoy un aviso y qué incluye: 30 días publicado, búsqueda por categoría y ciudad, postulaciones a tu WhatsApp.',
    alternates: { canonical: canonicalFor('/publicar-gratis') },
  };
}

const primaryCta =
  'inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 rounded-[12px] bg-[#E6B25A] text-ink font-bold text-base hover:bg-[#d8a548] transition-colors';

function Hero({ promo, pricing }: { promo: ActivePromo | null; pricing: PlanPricingTable }) {
  const regular = formatGs(pricing.basico.priceGs);
  if (promo) {
    const until = formatPromoEnd(promo.endsAt);
    const days = promoDaysLeft(promo.endsAt);
    const free = promo.priceGs === 0;
    return (
      <>
        <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#E6B25A]">
          Promoción por tiempo limitado · {days === 1 ? 'Último día' : `Quedan ${days} días`}
        </p>
        <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.02em]">
          Publicá tu aviso de empleo {free ? 'gratis' : `a ${formatGs(promo.priceGs)}`} hasta el {until}
        </h1>
        <p className="mt-5 text-base sm:text-lg text-white/75 max-w-2xl mx-auto">
          Un aviso que queda publicado 30 días, que los postulantes pueden buscar y filtrar, y
          que les llega directo a tu WhatsApp. Después del {until}, publicar cuesta {regular}.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="#formulario" className={primaryCta}>
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
      </>
    );
  }
  return (
    <>
      <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#E6B25A]">
        Promociones para empresas
      </p>
      <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.02em]">
        Publicar empleos gratis en trabajo.com.py
      </h1>
      <p className="mt-5 text-base sm:text-lg text-white/75 max-w-2xl mx-auto">
        Hoy no hay una promoción activa. Cada tanto abrimos promociones por tiempo limitado en las
        que publicar un aviso es gratis. Mientras tanto, un aviso Básico cuesta {regular} por 30
        días.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="#formulario" className={primaryCta}>
          Publicar mi aviso
        </a>
        {siteWhatsAppNumber() && (
          <WhatsAppCta intent="promocion" variant="button" className="sm:w-auto sm:px-8" sourcePage="/publicar-gratis" />
        )}
      </div>
    </>
  );
}

export default async function PublicarGratisPage() {
  const [pricing, categories, cities] = await Promise.all([
    getPlanPricing(),
    getCategories(),
    getCities(),
  ]);
  const promo = activePromo(pricing.basico);
  const free = promo?.priceGs === 0;
  const regular = formatGs(pricing.basico.priceGs);
  const selfServeEnabled = employerDashboardEnabled() && employerSignupEnabled();

  const faq = promo
    ? [
        {
          q: free ? '¿Es realmente gratis?' : '¿Cuánto cuesta?',
          a: free
            ? `Sí. Hasta el ${formatPromoEnd(promo.endsAt)}, publicar un aviso Básico no tiene costo, y el aviso queda publicado sus 30 días completos.`
            : `Hasta el ${formatPromoEnd(promo.endsAt)}, un aviso Básico cuesta ${formatGs(promo.priceGs)} en lugar de ${regular}.`,
        },
        {
          q: `¿Qué pasa después del ${formatPromoEnd(promo.endsAt)}?`,
          a: `Los avisos enviados antes de esa fecha siguen con la promoción hasta cumplir sus 30 días. Los nuevos avisos cuestan ${regular}.`,
        },
      ]
    : [
        {
          q: '¿Se puede publicar un empleo gratis?',
          a: `En trabajo.com.py, durante nuestras promociones por tiempo limitado. Hoy no hay una activa: un aviso Básico cuesta ${regular} por 30 días. Cuando abrimos una promoción la anunciamos en el sitio, y si nos escribís por WhatsApp te avisamos.`,
        },
        {
          q: '¿Qué incluye un aviso pago?',
          a: `30 días publicado, búsqueda por categoría y ciudad, una página propia preparada para Google y postulaciones directo a tu WhatsApp. ${INVOICE_NOTE}`,
        },
      ];
  faq.push(
    {
      q: '¿Cuándo se publica mi aviso?',
      a: `Cuando nuestro equipo lo revisa y aprueba. ${WHATSAPP_HOURS_COPY}`,
    },
    {
      q: '¿Puedo destacar mi aviso?',
      a: `Sí. Con Destacado tu aviso aparece primero en los resultados y en la portada, por ${formatGs(pricing.destacado.priceGs)} por 30 días. ${INVOICE_NOTE}`,
    },
  );

  return (
    <>
      <section className="bg-ink text-white px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <Hero promo={promo} pricing={pricing} />
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <section className="pb-14">
          <h2 className="text-2xl font-bold text-ink text-center mb-6">
            Plataformas para publicar empleos: redes vs. un portal de empleo
          </h2>
          <PostVsListing />
        </section>

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

        <section id="formulario" className="pb-14 scroll-mt-24">
          <div className="max-w-3xl mx-auto">
            {promo ? (
              <div className="rounded-[10px] border-2 border-brand/40 bg-brand-tint px-5 py-4 text-center mb-6">
                <p className="text-lg font-bold text-ink">
                  {free ? 'Gratis' : formatGs(promo.priceGs)} hasta el {formatPromoEnd(promo.endsAt)}{' '}
                  <span className="text-sm font-normal text-ink-secondary line-through">{regular}</span>
                </p>
                <p className="text-sm text-ink-secondary">
                  {promoDaysLeft(promo.endsAt) === 1
                    ? 'Hoy es el último día de la promoción.'
                    : `Quedan ${promoDaysLeft(promo.endsAt)} días de promoción.`}
                </p>
              </div>
            ) : (
              <p className="mb-6 rounded-[10px] border border-border bg-white px-5 py-4 text-center text-sm text-ink-secondary">
                Aviso Básico: <strong className="text-ink">{regular}</strong> por 30 días. Te
                enviamos los datos de pago por WhatsApp; el aviso se publica una vez aprobado por el
                equipo. {INVOICE_NOTE}
              </p>
            )}
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

        <section className="pb-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-6">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faq.map((item) => (
              <div key={item.q} className="bg-white rounded-[10px] border border-border p-5">
                <h3 className="font-semibold text-ink mb-2">{item.q}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <a href="#formulario" className={primaryCta}>
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
