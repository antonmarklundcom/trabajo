import type { Metadata } from 'next';
import { canonicalFor } from '@/lib/seo';
import { siteWhatsAppNumber, WHATSAPP_HOURS_COPY, type EmployerIntent } from '@/lib/whatsapp';
import { getLaunchPromoStatus } from '@/lib/promo';
import { getPlanPricing } from '@/lib/pricing';
import {
  PLAN_KEYS,
  PLAN_LABELS,
  PLAN_PERIOD,
  activePromo,
  formatGs,
  INVOICE_NOTE,
  formatPlanPrice,
  formatPrice,
  formatPromoEnd,
  pricePerDayGs,
  type PlanKey,
  type PlanPricingTable,
} from '@/lib/plans';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import WhatsAppCta from '@/components/WhatsAppCta';
import LaunchPromoStrip from '@/components/LaunchPromoStrip';
import PublishPromoBanner from '@/components/PublishPromoBanner';
import { EmployerBenefits } from '@/components/EmployerBenefits';
import BlogPostLinks from '@/components/BlogPostLinks';
import { blogCategoryPath, getLatestBlogPosts } from '@/lib/blog';
import Link from 'next/link';

// Same as /publicar: the "Leé más" row reads published posts, and a
// scheduled post reaching its date has no write to refresh this page. The
// same timer bounds how long a promotion that just ended keeps showing.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Planes y precios para empleadores',
  description:
    'Planes para publicar empleos en trabajo.com.py: Básico, Destacado y Empresa. Precios en guaraníes, sin contratos.',
  alternates: { canonical: canonicalFor('/planes') },
};

// The copy of each package. Prices are NOT here: they come from
// lib/pricing.ts (edited in /admin/precios), so this page and every other one
// that names a price cannot disagree.
//
// Three packages on purpose (owner decision 2026-09-27): Básico is the entry
// point, Destacado is the one the page steers toward (highlighted, middle),
// and Empresa is the high-ticket anchor that makes Destacado read as the
// sensible choice. Features list only what the team actually delivers today.
const PLAN_COPY: Record<
  PlanKey,
  {
    badge?: string;
    description: string;
    features: string[];
    cta: string;
    ctaHref: string;
    /** Set to route the CTA through WhatsAppCta instead of a plain Link. */
    whatsappIntent?: EmployerIntent;
  }
> = {
  basico: {
    description: 'Tu aviso publicado en el portal, con postulaciones directo a tu WhatsApp.',
    features: [
      'Publicación estándar de empleo',
      'Visible en el listado general y en su categoría y ciudad',
      'Formulario de postulación integrado',
      'Botón de aplicación por WhatsApp',
      'Activo por 30 días',
    ],
    cta: 'Publicar aviso',
    ctaHref: '/publicar',
  },
  destacado: {
    badge: 'Recomendado',
    description: 'Para el puesto que no puede esperar. Tu aviso aparece primero.',
    features: [
      'Todo lo del plan Básico',
      'Posición destacada en resultados y en la portada',
      'Badge "Destacado" visible',
      'Borde de acento en la tarjeta',
      '30 días destacado (también 15, 60 o 90 días)',
      'Atención prioritaria del equipo',
    ],
    // Still a conversation, not a checkout: the team confirms, the employer
    // pays by transfer, and an operator opens the window from
    // /admin/empleos/[id] (grantJobFeature). PLAN-PAGOPAR.md is where this
    // becomes self-serve. WhatsApp here is for buying, never for publishing.
    cta: 'Quiero destacar mi aviso',
    ctaHref: '/contacto',
    whatsappIntent: 'destacado',
  },
  empresa: {
    badge: 'Para contratar todo el mes',
    description: 'Para empresas y consultoras que publican varios puestos por mes.',
    features: [
      'Publicaciones ilimitadas durante el mes',
      'Avisos destacados incluidos',
      // Run by the team on the customer's own Meta ad budget — which is why
      // the price is "desde" and states no maximum (PLAN_PRICE_PREFIX).
      'Campañas en Facebook e Instagram para tus búsquedas',
      'Perfil de empresa con logo',
      // Only what exists (/empresa/postulaciones).
      'Panel para gestionar las postulaciones',
      'Un contacto directo en el equipo',
    ],
    cta: 'Hablemos',
    ctaHref: '/contacto',
    whatsappIntent: 'empresa',
  },
};

function PriceBlock({ plan, pricing }: { plan: PlanKey; pricing: PlanPricingTable }) {
  const row = pricing[plan];
  const promo = activePromo(row);
  if (promo) {
    return (
      <>
        <p className="text-sm text-ink-secondary">
          <span className="line-through">{formatGs(row.priceGs)}</span>{' '}
          <span className="font-semibold text-brand">Promoción</span>
        </p>
        <p className="text-3xl font-bold text-ink">{formatPrice(promo.priceGs)}</p>
        <p className="text-sm text-ink-secondary mt-1">
          hasta el {formatPromoEnd(promo.endsAt)}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-3xl font-bold text-ink">{formatPlanPrice(plan, row.priceGs)}</p>
      <p className="text-sm text-ink-secondary mt-1">{PLAN_PERIOD[plan]}</p>
      {plan === 'empresa' ? (
        <p className="text-xs text-ink-secondary mt-1">
          La inversión en anuncios la definís vos y se paga aparte.
        </p>
      ) : (
        <p className="text-xs text-ink-secondary mt-1">
          Menos de {formatGs(pricePerDayGs(row))} por día
        </p>
      )}
    </>
  );
}

export default async function PlanesPage() {
  const showPlans = process.env.NEXT_PUBLIC_SHOW_PLANS !== 'false';
  // Falls back to ctaHref when NEXT_PUBLIC_WHATSAPP_LEADS is unset, so a
  // missing number is a working /contacto link rather than a wa.me/ that
  // goes nowhere (WhatsAppCta itself renders null in that case).
  const hasWhatsApp = Boolean(siteWhatsAppNumber());
  const [promo, pricing, employerPosts] = await Promise.all([
    getLaunchPromoStatus(),
    getPlanPricing(),
    getLatestBlogPosts(2, 'para-empresas'),
  ]);
  const launchPromoActive = promo.enabled && promo.remaining > 0;
  const basicoPromo = activePromo(pricing.basico);

  const faq = [
    {
      q: '¿Cuánto cuesta publicar un empleo?',
      a: basicoPromo
        ? `Por la promoción, publicar un aviso Básico ${basicoPromo.priceGs === 0 ? 'es gratis' : `cuesta ${formatGs(basicoPromo.priceGs)}`} hasta el ${formatPromoEnd(basicoPromo.endsAt)}. Después, ${formatGs(pricing.basico.priceGs)} por aviso por 30 días. Destacado: ${formatGs(pricing.destacado.priceGs)} por aviso. Empresa: desde ${formatGs(pricing.empresa.priceGs)} por mes, más tu inversión en anuncios.`
        : `Básico: ${formatGs(pricing.basico.priceGs)} por aviso por 30 días. Destacado: ${formatGs(pricing.destacado.priceGs)} por aviso. Empresa: desde ${formatGs(pricing.empresa.priceGs)} por mes, más tu inversión en anuncios.`,
    },
    ...(basicoPromo
      ? [
          {
            q: '¿Qué pasa con mi aviso cuando termina la promoción?',
            a: 'Nada: los avisos enviados durante la promoción se publican con ella por sus 30 días completos, aunque la promoción termine antes.',
          },
        ]
      : []),
    {
      q: '¿Cómo publico?',
      a: `Completá el formulario de «Publicar empleo» con el puesto, la ciudad y un número de contacto. Nuestro equipo revisa cada aviso y lo publica una vez aprobado. ${WHATSAPP_HOURS_COPY}`,
    },
    {
      q: '¿Cómo pago Destacado o Empresa?',
      a: `Escribinos por WhatsApp y te enviamos los datos para pagar por transferencia. ${INVOICE_NOTE} El pago compra visibilidad, no la aprobación: todo aviso pasa por la revisión del equipo.`,
    },
    {
      q: '¿Qué incluye la publicidad del plan Empresa?',
      a: 'Armamos y gestionamos campañas en Facebook e Instagram (Meta) para tus búsquedas. El monto que invertís en anuncios lo definís vos y se paga aparte del plan.',
    },
    {
      q: '¿Los candidatos pagan algo?',
      a: 'No. trabajo.com.py es completamente gratuito para buscadores de empleo, siempre.',
    },
    {
      q: '¿Cómo llegan los postulantes?',
      a: 'Los candidatos se contactan directamente por WhatsApp o a través del formulario de postulación integrado en cada empleo.',
    },
  ];

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Planes para empleadores</h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Precios claros en guaraníes, sin contratos. {INVOICE_NOTE} Nuestro equipo revisa cada
          aviso antes de publicarlo.
        </p>
      </div>

      <PublishPromoBanner pricing={pricing} />
      <LaunchPromoStrip promo={promo} />

      {showPlans && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:items-stretch">
          {PLAN_KEYS.map((key) => {
            const plan = PLAN_COPY[key];
            const highlighted = key === 'destacado';
            const ctaClassName = `mt-8 w-full py-3 px-4 rounded-[10px] text-center font-semibold text-sm transition-colors ${
              highlighted || (key === 'basico' && basicoPromo)
                ? 'bg-brand hover:bg-brand-hover text-white'
                : 'border-2 border-brand text-brand hover:bg-brand-tint'
            }`;
            const cta =
              key === 'basico' && basicoPromo?.priceGs === 0 ? 'Publicar gratis ahora' : plan.cta;
            return (
              <div
                key={key}
                className={`bg-white rounded-[10px] border p-6 flex flex-col ${
                  highlighted ? 'border-brand shadow-md ring-2 ring-brand/20 md:-my-2' : 'border-border'
                }`}
              >
                <div className="mb-4 min-h-6">
                  {plan.badge && (
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        highlighted ? 'bg-brand text-white' : 'bg-surface-2 text-ink-secondary'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-ink">{PLAN_LABELS[key]}</h2>
                <div className="mt-3 mb-4">
                  <PriceBlock plan={key} pricing={pricing} />
                  {key === 'destacado' && launchPromoActive && (
                    <p className="text-sm font-semibold text-gold-strong mt-2">
                      Gratis 90 días para los primeros 100 avisos aprobados
                    </p>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mb-6">{plan.description}</p>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#44403A]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="text-success flex-shrink-0 mt-0.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.whatsappIntent && hasWhatsApp ? (
                  <WhatsAppCta
                    intent={plan.whatsappIntent}
                    promoActive={launchPromoActive}
                    label={cta}
                    sourcePage="/planes"
                    className="mt-8"
                  />
                ) : (
                  <Link href={plan.ctaHref} className={ctaClassName}>
                    {cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* The value case, after the prices: why a listing here beats a post
          in a feed (components/EmployerBenefits.tsx). */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-ink mb-2">Por qué publicar en trabajo.com.py</h2>
        <p className="text-sm text-ink-secondary mb-6">
          Un portal de empleos, no un feed: tu aviso queda ordenado y se puede buscar.
        </p>
        <EmployerBenefits />
      </section>

      {/* A quiet "Leé más" row under the cards (PLAN-GROWTH.md §4 C2). */}
      <BlogPostLinks
        title="Leé más"
        posts={employerPosts}
        tone="quiet"
        moreHref={blogCategoryPath('para-empresas')}
        moreLabel="Más para empresas"
        className="mt-10"
      />

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-ink mb-6">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {faq.map((item) => (
            <div key={item.q} className="bg-white rounded-[10px] border border-border p-5">
              <h3 className="font-semibold text-ink mb-2">{item.q}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    <FloatingWhatsApp />
    </>
  );
}
