import type { Metadata } from 'next';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import Link from 'next/link';
import { getCategories, getCities } from '@/lib/data';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import EmployerForm from '@/components/EmployerForm';
import WhatsAppCta from '@/components/WhatsAppCta';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

export const metadata: Metadata = {
  title: 'Publicá tu empleo gratis en Paraguay — por WhatsApp o formulario',
  description:
    'Publicá tu oferta de empleo en trabajo.com.py por WhatsApp o con el formulario. Nuestro equipo revisa y publica cada aviso. Gratuito para comenzar.',
  alternates: { canonical: canonicalFor('/publicar') },
};

export default async function PublicarPage() {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  // Both flags, same reasoning as the route handler: /empresa/* 404s while the
  // dashboard is dark, so a link to it would be a link to nothing.
  const selfServeEnabled = employerDashboardEnabled() && employerSignupEnabled();

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Publicá tu empleo gratis</h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Elegí cómo preferís hacerlo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Card A — WhatsApp, first on mobile and desktop (PLAN-GROWTH.md §4
            W3 — WhatsApp is the primary path in this market). */}
        <div className="bg-white rounded-[10px] border-2 border-wa/30 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-2">Por WhatsApp (más rápido)</h2>
          <p className="text-sm text-ink-secondary mb-6">
            Mandanos el puesto, la ciudad y un número de contacto. {WHATSAPP_HOURS_COPY} Lo
            publicamos cuando esté aprobado.
          </p>
          <WhatsAppCta intent="publicar" sourcePage="/publicar" />
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
    </div>
    <FloatingWhatsApp />
    </>
  );
}
