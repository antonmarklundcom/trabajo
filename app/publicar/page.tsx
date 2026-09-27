import type { Metadata } from 'next';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import { getLaunchPromoStatus } from '@/lib/promo';
import Link from 'next/link';
import { getCategories, getCities } from '@/lib/data';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import EmployerForm from '@/components/EmployerForm';
import LaunchPromoStrip from '@/components/LaunchPromoStrip';
import BlogPostLinks from '@/components/BlogPostLinks';
import { blogCategoryPath, getLatestBlogPosts } from '@/lib/blog';

// The "Leé más" row reads published posts. An article write refreshes this
// page (lib/cache.ts BLOG_PATHS); the timer covers the one change with no
// write behind it — a scheduled post reaching its date.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Publicá tu empleo gratis en Paraguay',
  description:
    'Publicá tu oferta de empleo en trabajo.com.py con el formulario. Nuestro equipo revisa y publica cada aviso. Gratuito para comenzar.',
  alternates: { canonical: canonicalFor('/publicar') },
};

export default async function PublicarPage() {
  const [categories, cities, promo, employerPosts] = await Promise.all([
    getCategories(),
    getCities(),
    getLaunchPromoStatus(),
    getLatestBlogPosts(2, 'para-empresas'),
  ]);
  // Both flags, same reasoning as the route handler: /empresa/* 404s while the
  // dashboard is dark, so a link to it would be a link to nothing.
  const selfServeEnabled = employerDashboardEnabled() && employerSignupEnabled();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Publicá tu empleo gratis</h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Completá el formulario con los datos del puesto. Nuestro equipo revisa cada aviso antes
          de publicarlo.
        </p>
      </div>

      <LaunchPromoStrip promo={promo} />

      <div className="grid grid-cols-1 gap-6">
        {/* The form is the only publish path: /api/publicar writes the job as
            `pending` for /admin review. There is deliberately no "publicá por
            WhatsApp" shortcut — a chat creates no listing, so the team would
            have to retype it by hand. */}
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-2">Con el formulario</h2>
          <p className="text-sm text-ink-secondary mb-6">
            Podés pegar la descripción completa. {WHATSAPP_HOURS_COPY}
          </p>
          <EmployerForm categories={categories} cities={cities} />
          <p className="mt-6 text-center text-xs text-ink-secondary">
            Al enviar este formulario, nuestro equipo revisará tu solicitud y te contactará para
            coordinar la publicación. No publicamos datos de contacto de empleadores sin su
            consentimiento.
          </p>
        </div>

        {/* Self-serve, last, only while both flags are on */}
        {selfServeEnabled && (
          <div className="rounded-[10px] border border-border bg-surface-2 px-4 py-4 text-sm text-ink-secondary sm:px-6">
            ¿Preferís cargar tus avisos vos mismo?{' '}
            <Link href="/empresa/registro" className="text-brand hover:underline font-medium">
              Creá una cuenta de empresa
            </Link>{' '}
            y cargalos cuando quieras. Nuestro equipo los revisa y aprueba antes de publicarlos,
            igual que con el formulario.
          </div>
        )}
      </div>

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
  );
}
