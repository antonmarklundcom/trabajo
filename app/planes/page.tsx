import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Planes y precios para empleadores',
  description:
    'Publicá tus empleos en trabajo.com.py. Gratuito para comenzar. Planes con mayor visibilidad disponibles.',
};

const plans = [
  {
    name: 'Básico',
    price: 'Gratis',
    priceNote: 'siempre',
    featured: false,
    description: 'Ideal para comenzar. Publicá tu empleo y recibí candidatos sin costo.',
    features: [
      'Publicación estándar de empleo',
      'Visible en listado general',
      'Formulario de postulación integrado',
      'Botón de aplicación por WhatsApp',
      'Activo por 30 días',
    ],
    cta: 'Publicar gratis',
    ctaHref: '/publicar',
  },
  {
    name: 'Destacado',
    price: 'Consultar',
    priceNote: 'por empleo',
    featured: true,
    description: 'Mayor visibilidad para posiciones clave. Aparecé primero en los resultados.',
    features: [
      'Todo lo del plan Básico',
      'Posición destacada en resultados y portada',
      'Badge "Destacado" visible',
      'Borde de acento en la tarjeta',
      'Activo por 30–60 días',
      'Soporte prioritario del equipo',
    ],
    cta: 'Consultá precios',
    ctaHref: '/contacto',
  },
  {
    name: 'Empresa',
    price: 'A medida',
    priceNote: 'paquete mensual',
    featured: false,
    description: 'Para empresas con necesidades continuas de reclutamiento.',
    features: [
      'Publicaciones ilimitadas',
      'Empleos destacados incluidos',
      'Perfil de empresa con logo',
      'Gestor de candidatos',
      'Reporte mensual de métricas',
      'Asesoría en reclutamiento',
    ],
    cta: 'Hablemos',
    ctaHref: '/contacto',
  },
];

export default function PlanesPage() {
  const showPlans = process.env.NEXT_PUBLIC_SHOW_PLANS !== 'false';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Planes para empleadores</h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Empezá gratis. Escalá cuando lo necesites. Nuestro equipo te acompaña en todo momento.
        </p>
      </div>

      {showPlans && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-[10px] border p-6 flex flex-col ${
                plan.featured
                  ? 'border-brand shadow-sm ring-2 ring-brand/20'
                  : 'border-border'
              }`}
            >
              {plan.featured && (
                <div className="mb-4">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-tint text-brand">
                    Más popular
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-ink">{plan.name}</h2>
              <div className="mt-3 mb-4">
                <span className="text-3xl font-bold text-ink">{plan.price}</span>
                <span className="text-sm text-ink-secondary ml-1">{plan.priceNote}</span>
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
              <Link
                href={plan.ctaHref}
                className={`mt-8 w-full py-3 px-4 rounded-[10px] text-center font-semibold text-sm transition-colors ${
                  plan.featured
                    ? 'bg-brand hover:bg-brand-hover text-white'
                    : 'border-2 border-brand text-brand hover:bg-brand-tint'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-ink mb-6">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {[
            {
              q: '¿Cuánto cuesta publicar un empleo?',
              a: 'El plan Básico es completamente gratuito. Podés publicar tu empleo y recibir candidatos sin costo. Los planes con mayor visibilidad tienen precios accesibles — consultanos.',
            },
            {
              q: '¿Quién publica los empleos?',
              a: 'En esta etapa, nuestro equipo revisa y publica cada oferta para garantizar calidad. Completás el formulario, te contactamos y publicamos en menos de 24 horas.',
            },
            {
              q: '¿Los candidatos pagan algo?',
              a: 'No. trabajo.com.py es completamente gratuito para buscadores de empleo, siempre.',
            },
            {
              q: '¿Cómo llegan los postulantes?',
              a: 'Los candidatos se contactan directamente por WhatsApp o a través del formulario de postulación integrado en cada empleo.',
            },
          ].map((item) => (
            <div key={item.q} className="bg-white rounded-[10px] border border-border p-5">
              <h3 className="font-semibold text-ink mb-2">{item.q}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
