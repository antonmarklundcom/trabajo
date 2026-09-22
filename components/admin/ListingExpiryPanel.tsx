'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LISTING_RENEWAL_DAYS, type ListingExpiryState } from '@/lib/listing-expiry';

/**
 * "Vigencia del aviso" on /admin/empleos/[id] (lib/listing-expiry.ts).
 *
 * Like FeaturePanel, it sends a number of DAYS, never a date: the new expiry is
 * computed server-side in renewJobListing(). And like FeaturePanel, `state` is
 * a prop worked out on the server — reading the clock during render is an
 * impure call, and the panel must not disagree with the page about whether a
 * listing is still up.
 *
 * `publishedNoticeHref` is the prefilled "tu aviso ya está publicado" WhatsApp
 * message to the job's own contact number — the only notice a /publicar
 * employer gets, since they have no account for an email to reach.
 */
type Props = {
  jobId: number;
  isPublished: boolean;
  expiresAt: string | null;
  state: ListingExpiryState;
  daysLeft: number | null;
  publishedNoticeHref: string | null;
  renewalNoticeHref: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATE_COPY: Record<ListingExpiryState, string> = {
  none: 'Sin vencimiento',
  active: 'Vigente',
  expiring: 'Vence pronto',
  expired: 'Vencido — ya no se muestra en el sitio',
};

export default function ListingExpiryPanel({
  jobId,
  isPublished,
  expiresAt,
  state,
  daysLeft,
  publishedNoticeHref,
  renewalNoticeHref,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function renew(days: number) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/empleos/${jobId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo renovar el aviso.');
        return;
      }
      router.refresh();
    } catch {
      setError('No se pudo renovar el aviso.');
    } finally {
      setBusy(false);
    }
  }

  if (!isPublished) {
    return (
      <p className="text-sm text-ink-secondary">
        El vencimiento se fija al aprobar el aviso: 30 días desde la publicación.
      </p>
    );
  }

  const tone =
    state === 'expired' ? 'text-error' : state === 'expiring' ? 'text-gold-strong' : 'text-ink';

  return (
    <div className="space-y-4">
      <div>
        <p className={`text-base font-semibold ${tone}`}>{STATE_COPY[state]}</p>
        {expiresAt && (
          <p className="text-sm text-ink-secondary mt-1">
            {state === 'expired' ? 'Venció el ' : 'Vence el '}
            {formatDate(expiresAt)}
            {daysLeft !== null && daysLeft > 0 && ` (en ${daysLeft} día${daysLeft === 1 ? '' : 's'})`}
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-2">Renovar</p>
        <div className="flex flex-wrap gap-2">
          {LISTING_RENEWAL_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              disabled={busy}
              onClick={() => renew(days)}
              className="px-4 py-2.5 rounded-[10px] border border-border bg-white text-sm font-medium text-ink hover:border-brand disabled:opacity-60"
            >
              +{days} días
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3 mt-2">
          Se suma al vencimiento actual si el aviso sigue vigente; si ya venció, cuenta desde hoy.
        </p>
        {error && <p className="text-sm text-error mt-2">{error}</p>}
      </div>

      {(publishedNoticeHref || renewalNoticeHref) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {publishedNoticeHref && (
            <a
              href={publishedNoticeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-[10px] bg-wa hover:bg-wa-strong text-white text-sm font-semibold"
            >
              Avisar que está publicado
            </a>
          )}
          {renewalNoticeHref && (
            <a
              href={renewalNoticeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-[10px] border border-wa text-wa-strong text-sm font-semibold hover:bg-success-tint"
            >
              Ofrecer renovación por WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
