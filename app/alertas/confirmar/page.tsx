import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import { notFound } from 'next/navigation';

import { jobAlertsEnabled } from '@/lib/flags';
import JobAlertLinkAction from '@/components/JobAlertLinkAction';

// The link in the confirmation email lands here. This page WRITES NOTHING and
// reads no database: it renders a button, and the button POSTs. A mail
// scanner that prefetches the link sees a page, not a confirmation.
// scripts/verify-alerts.ts asserts that nothing under app/alertas imports a
// database module.
//
// /alertas is in ACCOUNT_PATH_PREFIXES (lib/analytics-location.ts): the URL
// carries a live token, so GA never measures it.
export const metadata: Metadata = {
  title: 'Confirmar alerta de empleos',
  robots: { index: false, follow: false },
  // The bare path: the token is never part of any URL this page names.
  alternates: { canonical: canonicalFor('/alertas/confirmar') },
};

export default async function ConfirmarAlertaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  if (!jobAlertsEnabled()) notFound();

  const sp = await searchParams;
  const raw = sp.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
        <h1 className="text-xl font-bold text-ink">Confirmá tu alerta de empleos</h1>
        {token ? (
          <>
            <p className="mt-2 mb-6 text-sm text-ink-secondary">
              Te vamos a escribir como máximo una vez por semana, solo cuando haya empleos nuevos.
              Podés darte de baja desde cualquiera de esos emails.
            </p>
            <JobAlertLinkAction token={token} action="confirmar" />
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-secondary">
            Este enlace no es válido.{' '}
            <Link href="/empleos" className="text-brand hover:underline">
              Ver empleos
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
