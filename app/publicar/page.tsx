import type { Metadata } from 'next';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import { getLaunchPromoStatus } from '@/lib/promo';
import Link from 'next/link';
import { GUIDES } from '@/lib/guides';
import { getCategories, getCities } from '@/lib/data';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import EmployerForm from '@/components/EmployerForm';
import WhatsAppCta from '@/components/WhatsAppCta';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import LaunchPromoStrip from '@/components/LaunchPromoStrip';
import BlogPostLinks from '@/components/BlogPostLinks';
import { blogCategoryPath, getLatestBlogPosts } from '@/lib/blog';

// The "Leé más" row reads published posts. An article write refreshes this
// page (lib/cache.ts BLOG_PATHS); the timer covers the one change with no
// write behind it — a scheduled post reaching its date.
export const revalidate = 300;

export const metadata: Metadata = {
  // "buscar personal" is the employer-side query in the keyword data
  // (PLAN-SEO.md §1 Q8).
  title: 'Publicá tu empleo gratis y encontrá personal en Paraguay',
  description:
    '¿Buscás personal? Publicá tu oferta de empleo gratis en trabajo.com.py por WhatsApp o con el formulario y recibí postulantes en tu WhatsApp. Revisamos cada aviso.',
  alternates: { canonical: canonicalFor('/publicar') },
};

export default async function PublicarPage() {
  const [categories, cities, promo, employerPosts] = await Promise.all([
    getCategories(),
    getCities(),
    getLaunchPromoStatus(),
    getLatestBlogPosts(2, 'para-empresas'),
  ]);
  const promoActive = promo.enabled && promo.remaining > 0;
  // Both flags, same reasoning as the route handler: /empresa/* 404s while the
  // dashboard is dark, so a link to it would be a link to nothing.
  const selfServeEnabled = employerDashboardEnabled() && employerSignupEnabled();

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Publicá tu empleo gratis y encontrá personal</h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Elegí cómo preferís hacerlo.
        </p>
      </div>

      <LaunchPromoStrip promo={promo} />

      <div className="grid grid-cols-1 gap-6">
        {/* Card A — WhatsApp, first on mobile and desktop (PLAN-GROWTH.md §4
            W3 — WhatsApp is the primary path in this market). */}
        <div className="bg-white rounded-[10px] border-2 border-wa/30 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-2">Por WhatsApp (más rápido)</h2>
          <p className="text-sm text-ink-secondary mb-6">
            Mandanos el puesto, la ciudad y un número de contacto. {WHATSAPP_HOURS_COPY} Lo
            publicamos cuando esté aprobado.
          </p>
          <WhatsAppCta intent="publicar" promoActive={promoActive} sourcePage="/publicar" />
        </div>

        {/* Card B — form, the honest second option */}
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-2">Con el formulario</h2>
          <p className="text-sm text-ink-secondary mb-6">
            Ideal si querés pegar la descripción completa. {WHATSAPP_HOURS_COPY}
          </p>
          <EmployerForm categories={categories} cities={cities} />
          <p className="mt-6 text-center text-xs text-ink-secondary">
            Al enviar este formulario, nuestro equipo revisará tu solicitud y te contactará para
            coordinar la publicación. No publicamos datos de contacto de empleadores sin su
            consentimiento.
          </p>
        </div>

        {/* Card C — self-serve, last, only while both flags are on */}
        {selfServeEnabled && (
          <div className="rounded-[10px] border border-border bg-surface-2 px-4 py-4 text-sm text-ink-secondary sm:px-6">
            ¿Preferís cargar tus avisos vos mismo?{' '}
            <Link href="/empresa/registro" className="text-brand hover:underline font-medium">
              Creá una cuenta de empresa
            </Link>{' '}
            y cargalos cuando quieras. Nuestro equipo los revisa y aprueba antes de publicarlos,
            igual que con las opciones de arriba.
          </div>
        )}
      </div>

      {/* The employer-facing guides (lib/guides.ts): the payroll questions a
          small business looks up around the time it hires. */}
      <section className="mt-10" aria-labelledby="recursos-empleadores">
        <h2 id="recursos-empleadores" className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
          Recursos para empleadores
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['contrato', 'salarioMinimo', 'aguinaldo'] as const).map((key) => (
            <li key={key}>
              <Link
                href={GUIDES[key].href}
                className="block h-full rounded-[10px] border border-border bg-white p-4 hover:border-brand transition-colors"
              >
                <span className="block text-sm font-semibold text-ink">{GUIDES[key].label}</span>
                <span className="mt-1 block text-xs text-ink-secondary">{GUIDES[key].blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* A quiet "Leé más" row under the cards (PLAN-GROWTH.md §4 C2) —
          the employer articles' way in from the page employers land on. */}
      <BlogPostLinks
        title="Leé más"
        posts={employerPosts}
        tone="quiet"
        moreHref={blogCategoryPath('para-empresas')}
        moreLabel="Más para empresas"
        className="mt-10"
      />
    </div>
    <FloatingWhatsApp />
    </>
  );
}
