'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * The button on /empresa/confirmar-aviso. The page renders it; nothing happens
 * until a person presses it. Unlike VerifyEmail there is deliberately no
 * effect that POSTs on mount: this token renews or closes a live listing, and
 * a mail scanner that renders the page must not be able to answer for the
 * employer.
 */
export default function ListingConfirmForm({
  token,
  action,
}: {
  token: string;
  action: 'open' | 'close';
}) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function submit() {
    setState('working');
    try {
      const res = await fetch('/api/empresa/confirmar-aviso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? 'No pudimos registrar tu respuesta.');
        setState('failed');
        return;
      }
      if (action === 'open' && typeof data.expiresAt === 'string') {
        const until = new Date(data.expiresAt).toLocaleDateString('es-PY', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'America/Asuncion',
        });
        setMessage(`Listo, gracias. Tu aviso sigue publicado hasta el ${until}.`);
      } else {
        setMessage('Listo, cerramos el aviso. Ya no aparece en el sitio. ¡Gracias por avisarnos!');
      }
      setState('done');
    } catch {
      setMessage('Error de conexión. Intentá de nuevo.');
      setState('failed');
    }
  }

  if (state === 'done' || state === 'failed') {
    return (
      <div className="space-y-4" role="status">
        <p className={`text-sm ${state === 'done' ? 'text-ink' : 'text-error bg-error-tint rounded-[10px] px-4 py-3'}`}>
          {message}
        </p>
        <Link href="/empresa" className="block text-sm text-brand hover:underline">
          Ir a mi panel
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={state === 'working'}
      className={`w-full py-3 px-6 rounded-[10px] font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        action === 'open'
          ? 'bg-brand hover:bg-brand-hover text-white'
          : 'border border-border-strong bg-white text-ink hover:border-brand'
      }`}
    >
      {state === 'working'
        ? 'Guardando…'
        : action === 'open'
          ? 'Sí, sigue abierto'
          : 'Sí, cerrar el aviso'}
    </button>
  );
}
