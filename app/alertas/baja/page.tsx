import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';

import JobAlertLinkAction from '@/components/JobAlertLinkAction';

// The "darme de baja" link in every job-alert email lands here. Like
// app/alertas/confirmar, this page WRITES NOTHING and reads no database — a
// prefetched link must not unsubscribe anybody; the button POSTs.
//
// Never behind jobAlertsEnabled(): switching the feature off must not take
// away the way out for someone who already subscribed (lib/flags.ts).
export const metadata: Metadata = {
  title: 'Darte de baja de las alertas de empleos',
  robots: { index: false, follow: false },
  // The bare path: the token is never part of any URL this page names.
  alternates: { canonical: canonicalFor('/alertas/baja') },
};

export default async function BajaAlertaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
        <h1 className="text-xl font-bold text-ink">Darte de baja de esta alerta</h1>
        {token ? (
          <>
            <p className="mt-2 mb-6 text-sm text-ink-secondary">
              Vamos a borrar esta alerta y tu email de ella. No vas a recibir más estos avisos.
            </p>
            <JobAlertLinkAction token={token} action="baja" />
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
