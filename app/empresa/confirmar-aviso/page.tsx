import type { Metadata } from 'next';
import Link from 'next/link';
import ListingConfirmForm from '@/components/empresa/ListingConfirmForm';
import { formatListingDate, sameExpiry, verifyListingConfirmToken } from '@/lib/listing-confirm';
import { computeRenewedExpiry, LISTING_DAYS } from '@/lib/listing-expiry';
import { findListingConfirmTarget } from '@/lib/db/listing-confirm';

// /empresa/* is already noindex (app/empresa/layout.tsx) and disallowed in
// robots.ts; restated here like /empresa/verificar does. `no-referrer` because
// the token is in this page's URL and must not travel to wherever the visitor
// goes next.
export const metadata: Metadata = {
  title: '¿Tu aviso sigue abierto? — Empresas',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// GET renders; it never writes. The link arrives by email, and mail scanners
// fetch every link in a message — so this page only reads the token and the
// job row to decide what to show, and the answer is a POST the button sends
// (components/empresa/ListingConfirmForm.tsx → /api/empresa/confirmar-aviso).
// scripts/verify-listing-confirm.ts asserts from source that nothing here
// imports a write.

type View =
  | { kind: 'ready'; action: 'open' | 'close'; title: string | null; expiresAt: Date }
  | { kind: 'error'; message: string };

async function resolveView(token: string, now: Date): Promise<View> {
  if (!token) return { kind: 'error', message: 'Este enlace no es válido.' };

  const verdict = verifyListingConfirmToken(token, now);
  if (!verdict.ok) {
    return {
      kind: 'error',
      message:
        verdict.reason === 'expired'
          ? 'Este enlace venció. Podés gestionar tus avisos desde tu panel.'
          : 'Este enlace no es válido.',
    };
  }
  const { jobId, action, expiresAt } = verdict.payload;

  let title: string | null = null;
  try {
    const job = await findListingConfirmTarget(jobId);
    if (!job) return { kind: 'error', message: 'Este enlace no es válido.' };
    if (job.status !== 'published' || !sameExpiry(job.expiresAt, expiresAt)) {
      return {
        kind: 'error',
        message:
          'Este enlace ya no está activo: el aviso ya se renovó, se cerró o cambió desde que te escribimos.',
      };
    }
    title = job.title;
  } catch (err) {
    // The row check is repeated by the POST, inside the write itself. Failing
    // to read it here only costs the page the listing's title.
    console.error('[confirmar-aviso] job lookup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { kind: 'ready', action, title, expiresAt };
}

export default async function ConfirmarAvisoPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.t;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const now = new Date();
  const view = await resolveView(token, now);

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xl font-bold text-ink">trabajo.com.py</p>
          <p className="text-sm text-ink-secondary mt-1">Panel de empresas</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          {view.kind === 'error' ? (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold text-ink">No pudimos usar este enlace</h1>
              <p className="text-sm text-ink-secondary">{view.message}</p>
              <Link href="/empresa" className="block text-sm text-brand hover:underline">
                Ir a mi panel
              </Link>
            </div>
          ) : (
            <ReadyView view={view} now={now} token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReadyView({
  view,
  now,
  token,
}: {
  view: Extract<View, { kind: 'ready' }>;
  now: Date;
  token: string;
}) {
  const listing = view.title ? `«${view.title}»` : 'tu aviso';
  const currentUntil = formatListingDate(view.expiresAt);

  if (view.action === 'open') {
    const nextUntil = formatListingDate(computeRenewedExpiry(now, view.expiresAt, LISTING_DAYS));
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-ink">¿Tu aviso sigue abierto?</h1>
          <p className="text-sm text-ink-secondary">
            Confirmá que {listing} sigue buscando candidatos y lo mantenemos publicado{' '}
            {LISTING_DAYS} días más, hasta el <span className="font-medium text-ink">{nextUntil}</span>.
          </p>
          <p className="text-xs text-ink-3">Hoy vence el {currentUntil}.</p>
        </div>
        <ListingConfirmForm token={token} action="open" />
        <p className="text-xs text-ink-3">
          ¿Ya lo cubriste? Usá el botón «Ya lo cubrimos, cerralo» del mismo correo, o no hagas nada:
          el aviso deja de publicarse solo el {currentUntil}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-ink">¿Cerramos el aviso?</h1>
        <p className="text-sm text-ink-secondary">
          Si ya cubriste el puesto, cerramos {listing}: deja de aparecer en el sitio y no recibe más
          postulaciones. Las que ya recibiste siguen en tu panel.
        </p>
      </div>
      <ListingConfirmForm token={token} action="close" />
      <p className="text-xs text-ink-3">
        ¿Todavía está abierto? Usá el botón «Sí, sigue abierto» del mismo correo.
      </p>
    </div>
  );
}
