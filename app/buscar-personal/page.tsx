import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor, siteUrl } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import { getPlanPricing } from '@/lib/pricing';
import {
  INVOICE_NOTE,
  PLAN_KEYS,
  PLAN_LABELS,
  PLAN_PERIOD,
  activePromo,
  formatGs,
  formatPlanPrice,
  formatPrice,
  formatPromoEnd,
} from '@/lib/plans';
import JsonLd from '@/components/JsonLd';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import { EmployerBenefits, PostVsListing } from '@/components/EmployerBenefits';

// The evergreen employer page (docs/seo/KEYWORDS.md): what someone types when
// they need to hire rather than when they know our product — "busco
// empleados", "buscar personal", "busco personal", "se necesita personal",
// "contratar personal", "reclutamiento/selección de personal", "anuncios de
// empleo". Unlike /publicar-gratis it is permanent and indexed, and says
// "gratis" only while the Básico promotion really is free.
//
// It is honest about the recruitment-agency searches: we do not select or
// recommend candidates (/terminos §4), so the page says what we are instead.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Buscar personal en Paraguay — publicá tu aviso de empleo',
  description:
    '¿Buscás empleados para tu empresa? Publicá tu aviso de empleo en trabajo.com.py: 30 días publicado, fácil de encontrar por categoría y ciudad, y las postulaciones te llegan a tu WhatsApp.',
  alternates: { canonical: canonicalFor('/buscar-personal') },
};

export default async function BuscarPersonalPage() {
  const pricing = await getPlanPricing();
  const promo = activePromo(pricing.basico);
  const free = promo?.priceGs === 0;
  const ctaHref = promo ? '/publicar-gratis' : '/publicar';
  const ctaLabel = free ? 'Publicar mi aviso gratis' : 'Publicar mi aviso';
  const site = siteUrl();

  const faq = [
    {
      q: '¿Cómo busco personal para mi empresa?',
      a: 'Publicá un aviso con el puesto, la ciudad, la descripción y tu WhatsApp. Nuestro equipo lo revisa y, una vez aprobado, queda publicado 30 días. Los postulantes lo encuentran buscando por categoría y ciudad y te escriben directo.',
    },
    {
      q: '¿Cuánto cuesta publicar una oferta de empleo?',
      a: promo
        ? `Por la promoción, un aviso Básico ${free ? 'es gratis' : `cuesta ${formatGs(promo.priceGs)}`} hasta el ${formatPromoEnd(promo.endsAt)}; después, ${formatGs(pricing.basico.priceGs)} por 30 días. ${INVOICE_NOTE}`
        : `Un aviso Básico cuesta ${formatGs(pricing.basico.priceGs)} por 30 días, y Destacado ${formatGs(pricing.destacado.priceGs)}. ${INVOICE_NOTE}`,
    },
    {
      q: '¿Son una agencia de selección o reclutamiento de personal?',
      a: 'No. Somos un portal de empleos: publicamos tu aviso y los candidatos te contactan a vos. La selección y la decisión de a quién contratar son tuyas. Si necesitás más alcance, el plan Empresa incluye campañas en Facebook e Instagram para tus búsquedas.',
    },
    {
      q: '¿Cómo me contactan los postulantes?',
      a: 'Por WhatsApp al número que indicás en el aviso, o con el formulario de postulación de cada aviso.',
    },
    {
      q: '¿Cuándo se publica mi aviso?',
      a: `Cuando nuestro equipo lo revisa y aprueba. ${WHATSAPP_HOURS_COPY}`,
    },
  ];

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site },
      { '@type': 'ListItem', position: 2, name: 'Buscar personal', item: `${site}/buscar-personal` },
    ],
  };

  const cta =
    'inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 rounded-[12px] bg-brand hover:bg-brand-hover text-white font-bold text-base transition-colors';

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] text-ink">
            ¿Buscás personal? Publicá tu aviso de empleo en Paraguay
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-secondary">
            Si necesitás empleados para tu empresa, publicá tu oferta de empleo en trabajo.com.py:
            queda publicada 30 días, los postulantes la encuentran por categoría y ciudad, y te
            escriben directo a tu WhatsApp.
            {promo && free && ` Hasta el ${formatPromoEnd(promo.endsAt)}, publicar es gratis.`}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={ctaHref} className={cta}>
              {ctaLabel}
            </Link>
            <Link href="/planes" className="text-brand font-semibold hover:underline">
              Ver planes y precios
            </Link>
          </div>
        </header>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-ink text-center">Cómo buscar empleados en 3 pasos</h2>
          <ol className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ['Publicá tu aviso', 'Completá el formulario con el puesto, la ciudad, la descripción y tu WhatsApp de contacto.'],
              ['Revisamos y publicamos', `Nuestro equipo revisa cada aviso antes de publicarlo. ${WHATSAPP_HOURS_COPY}`],
              ['Recibí postulaciones', 'Los candidatos te escriben a tu WhatsApp o se postulan con el formulario. Vos elegís a quién contactar.'],
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

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-ink text-center">
            Por qué publicar tu búsqueda en un portal de empleo
          </h2>
          <p className="mt-3 text-center text-ink-secondary max-w-2xl mx-auto">
            Un anuncio de empleo en un portal no se pierde entre los posteos del día: queda
            ordenado, se puede buscar y está al lado de avisos revisados.
          </p>
          <EmployerBenefits className="mt-8" />
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-ink text-center mb-6">
            Clasificados y redes vs. un portal de empleo
          </h2>
          <PostVsListing />
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-ink text-center">Planes para publicar ofertas de empleo</h2>
          <p className="mt-3 text-center text-sm text-ink-secondary">{INVOICE_NOTE}</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLAN_KEYS.map((key) => {
              const plan = pricing[key];
              const planPromo = activePromo(plan);
              return (
                <Link
                  key={key}
                  href="/planes"
                  className={`block bg-white rounded-[10px] border p-5 hover:border-brand transition-colors ${
                    key === 'destacado' ? 'border-brand' : 'border-border'
                  }`}
                >
                  <h3 className="font-bold text-ink">{PLAN_LABELS[key]}</h3>
                  {planPromo ? (
                    <p className="mt-2">
                      <span className="text-2xl font-bold text-ink">{formatPrice(planPromo.priceGs)}</span>{' '}
                      <span className="text-sm text-ink-secondary">
                        hasta el {formatPromoEnd(planPromo.endsAt)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-2xl font-bold text-ink">{formatPlanPrice(key, plan.priceGs)}</p>
                  )}
                  <p className="text-sm text-ink-secondary">{PLAN_PERIOD[key]}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-6">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faq.map((item) => (
              <div key={item.q} className="bg-white rounded-[10px] border border-border p-5">
                <h3 className="font-semibold text-ink mb-2">{item.q}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link href={ctaHref} className={cta}>
              {ctaLabel}
            </Link>
          </p>
        </section>
      </div>
      <FloatingWhatsApp />
    </>
  );
}
