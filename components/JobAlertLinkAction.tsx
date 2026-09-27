'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * The button on the two pages a job-alert email links to (app/alertas/*).
 *
 * The page itself writes nothing: mail clients and security scanners prefetch
 * links, so a GET that confirmed or unsubscribed would act on a click nobody
 * made. The write is this POST, issued only when a person presses the button —
 * not from an effect on mount, which a scanner that runs scripts would trigger
 * just as well.
 */
export default function JobAlertLinkAction({
  token,
  action,
}: {
  token: string;
  action: 'confirmar' | 'baja';
}) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function run() {
    setState('working');
    try {
      const res = await fetch(`/api/alertas/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(typeof data?.error === 'string' ? data.error : 'No pudimos completar el pedido.');
        setState('failed');
        return;
      }
      if (action === 'confirmar') {
        setMessage(
          data?.already
            ? 'Tu alerta ya estaba confirmada. Te escribimos cuando haya empleos nuevos.'
            : 'Listo, tu alerta quedó activada. Te escribimos como máximo una vez por semana, cuando haya empleos nuevos.',
        );
      } else {
        setMessage('Listo, te diste de baja. No vas a recibir más estos emails.');
      }
      setState('done');
    } catch {
      setMessage('Error de conexión. Intentá de nuevo.');
      setState('failed');
    }
  }

  if (state === 'done' || state === 'failed') {
    return (
      <div className="space-y-4">
        <p role="status" className={`text-sm ${state === 'done' ? 'text-ink' : 'text-error'}`}>
          {message}
        </p>
        <Link href="/empleos" className="inline-block text-sm font-medium text-brand hover:underline">
          Ver empleos
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === 'working'}
      className={`w-full py-3 rounded-[10px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        action === 'confirmar'
          ? 'bg-brand hover:bg-brand-hover text-white'
          : 'border border-border-strong text-ink hover:border-brand hover:text-brand bg-white'
      }`}
    >
      {state === 'working'
        ? 'Un momento…'
        : action === 'confirmar'
          ? 'Confirmar mi alerta'
          : 'Darme de baja'}
    </button>
  );
}
