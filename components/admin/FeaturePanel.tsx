'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FEATURE_DURATION_DAYS,
  FEATURE_GRANT_CHANNEL_LABELS,
  FEATURE_PAYMENT_LABELS,
  FEATURE_PAYMENT_METHODS,
} from '@/lib/featured';

/**
 * Fulfilling a Destacado sale that happened on WhatsApp.
 *
 * The panel sends a number of DAYS, never a date — the window is computed
 * server-side in grantJobFeature(). What the operator picks here is what they
 * actually agreed on the call ("30 días, Gs. 150.000, transferencia"), which is
 * also exactly what the activity_log row needs to settle a later dispute.
 *
 * The raw `Destacado hasta` field further up the job form still works and is
 * still the override. This is the fast path, not a replacement.
 */
/**
 * `isActive` is a PROP, not `featuredUntil > Date.now()` computed here. The
 * open/closed question is answered in SQL by getJobFeatureState(), for the same
 * reason getEmployerPlanSummary() answers it there: reading the clock during
 * render is an impure call, and the admin panel must not disagree with the
 * database about whether a window someone just paid for is open.
 */
/**
 * `channel` is how the LAST grant on this job opened its window — a WhatsApp
 * sale, an online payment, or the launch promotion (PLAN-GROWTH.md §4 P1).
 * Read from activity_log server-side, because that is where a window's
 * provenance lives; naming it here is what stops an operator from selling a
 * renewal to someone whose 90 days were comped.
 */
type Props = {
  jobId: number;
  featuredUntil: string | null;
  isActive: boolean;
  channel?: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeaturePanel({ jobId, featuredUntil, isActive, channel }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('transferencia');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function grant(days: number, extend: boolean) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch(`/api/admin/empleos/${jobId}/destacar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days,
          extend,
          amountGs: amount.trim() ? Number(amount.replace(/\D/g, '')) : null,
          method: method || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo aplicar el Destacado.');
        return;
      }
      setDone(`Destacado hasta ${formatDate(data.featuredUntil)}.`);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm('¿Quitar el Destacado de este empleo?')) return;
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch(`/api/admin/empleos/${jobId}/destacar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo quitar el Destacado.');
        return;
      }
      setDone('Destacado quitado.');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full px-3 py-2 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        {isActive ? (
          <>
            Destacado activo hasta{' '}
            <span className="font-medium text-ink">{formatDate(featuredUntil!)}</span>.
          </>
        ) : featuredUntil ? (
          <>
            El último Destacado venció el{' '}
            <span className="font-medium text-ink">{formatDate(featuredUntil)}</span>.
          </>
        ) : (
          'Este empleo nunca fue destacado.'
        )}
      </p>

      {featuredUntil && channel && FEATURE_GRANT_CHANNEL_LABELS[channel] && (
        <p className="text-sm text-ink-secondary">
          Origen del último Destacado:{' '}
          <span className="font-medium text-ink">{FEATURE_GRANT_CHANNEL_LABELS[channel]}</span>.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Monto (Gs.)</label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="150000"
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Cómo pagó</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
            {FEATURE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {FEATURE_PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Nota</label>
          <input
            type="text"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comprobante, contacto…"
            className={input}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-secondary mb-2">
          {isActive
            ? 'Extender la ventana actual (se suma a la fecha de vencimiento)'
            : 'Activar Destacado desde ahora'}
        </p>
        <div className="flex flex-wrap gap-2">
          {FEATURE_DURATION_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              disabled={busy}
              onClick={() => grant(days, isActive)}
              className="px-4 py-2 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isActive ? `+${days} días` : `${days} días`}
            </button>
          ))}
          {isActive && (
            <button
              type="button"
              disabled={busy}
              onClick={revoke}
              className="px-4 py-2 rounded-[10px] border border-border text-sm font-medium text-ink-secondary hover:border-error hover:text-error transition-colors disabled:opacity-60"
            >
              Quitar Destacado
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>}
      {done && <p className="text-sm text-success">{done}</p>}

      <p className="text-xs text-ink-3">
        La venta queda registrada en el historial de actividad con el monto, el medio de pago y la
        nota. El campo “Destacado hasta” del formulario de arriba sigue disponible como ajuste
        manual.
      </p>
    </div>
  );
}
