'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const INPUT =
  'w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

/** `basePath`: '/postulante' (default) or '/empresa' — see ResetRequestForm. */
export default function ResetConfirmForm({
  token,
  basePath = '/postulante',
}: {
  token: string;
  basePath?: '/postulante' | '/empresa';
}) {
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api${basePath}/recuperar/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cambiar la contraseña.');
        setSubmitting(false);
        return;
      }
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : basePath === '/postulante' ? '/postulante/perfil' : '/empresa');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-ink mb-1.5">Nueva contraseña</label>
        <input
          id={passwordId}
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
        <p className="text-xs text-ink-secondary mt-1">Mínimo 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor={confirmId} className="block text-sm font-medium text-ink mb-1.5">Repetir contraseña</label>
        <input
          id={confirmId}
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={INPUT}
        />
      </div>
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-brand">{error}</p>
          <Link href={`${basePath}/recuperar`} className="block text-sm text-brand hover:underline">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-[10px] bg-brand text-white text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
