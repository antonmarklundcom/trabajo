'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ARCO cancelación (PLAN-PHASE2.md §4.4). Two confirmations — the word ELIMINAR
 * and the current password — because this cannot be undone: there is no
 * soft-delete flag behind it and therefore nothing to restore from.
 *
 * Both are re-checked server-side in /api/postulante/mis-datos/eliminar. The
 * disabled button below is UX (AGENTS.md), not the gate.
 */
export default function DeleteAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ready = confirmText.trim().toUpperCase() === 'ELIMINAR' && password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!ready) return;
    if (
      !window.confirm(
        'Vas a eliminar tu cuenta y todos tus datos personales. Esta acción no se puede deshacer. ¿Continuar?',
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/postulante/mis-datos/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm: 'ELIMINAR' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No pudimos eliminar tu cuenta.');
        setSubmitting(false);
        return;
      }
      router.push(data.redirectTo ?? '/');
      router.refresh();
    } catch {
      setError('No pudimos eliminar tu cuenta. Tus datos siguen guardados.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="delete-password" className="block text-sm font-medium text-ink mb-1">
          Tu contraseña
        </label>
        <input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-[10px] border border-border px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="delete-confirm" className="block text-sm font-medium text-ink mb-1">
          Escribí <span className="font-mono">ELIMINAR</span> para confirmar
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full rounded-[10px] border border-border px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="px-4 py-2 rounded-[10px] text-sm font-medium text-white bg-error hover:bg-[#96190F] disabled:opacity-50 disabled:hover:bg-error transition-colors"
      >
        {submitting ? 'Eliminando...' : 'Eliminar mi cuenta y mis datos'}
      </button>
    </form>
  );
}
