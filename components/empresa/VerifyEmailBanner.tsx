'use client';

import { useState } from 'react';

/**
 * Shown on every /empresa/(dashboard) page while a self-registered account's
 * address is still unconfirmed.
 *
 * It is a prompt, never a gate: the panel below it works, and the copy says so
 * rather than implying the account is limited. The whole point of the resend
 * button is that an unset RESEND_API_KEY or a bounced first attempt must not
 * leave the confirmation permanently unreachable — the server never reveals
 * whether the mail actually went out (lib/email.ts degrades silently), so the
 * message here is about what was requested, not what was delivered.
 */
export default function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function resend() {
    setState('sending');
    try {
      const res = await fetch('/api/empresa/verificar/reenviar', { method: 'POST' });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="mb-6 rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
      <p>
        Todavía no confirmaste <span className="font-medium text-ink">{email}</span>. Tu cuenta
        funciona igual — confirmarlo nos ayuda a saber que la dirección es tuya.
      </p>
      {state === 'sent' ? (
        <p className="mt-2 text-ink">Te reenviamos el enlace. Revisá tu correo.</p>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending'}
          className="mt-2 text-brand hover:underline disabled:opacity-60"
        >
          {state === 'sending' ? 'Enviando…' : 'Reenviar el enlace de confirmación'}
        </button>
      )}
      {state === 'failed' && (
        <p className="mt-2 text-error">No se pudo reenviar. Probá de nuevo más tarde.</p>
      )}
    </div>
  );
}
