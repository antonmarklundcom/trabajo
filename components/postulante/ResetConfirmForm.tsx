'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const INPUT =
  'w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20';

export default function ResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
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
      const res = await fetch('/api/postulante/recuperar/confirmar', {
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
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : '/postulante/perfil');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
        <p className="text-xs text-[#57514A] mt-1">Mínimo 8 caracteres.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Repetir contraseña</label>
        <input
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
          <p className="text-sm text-[#C0362A]">{error}</p>
          <Link href="/postulante/recuperar" className="block text-sm text-[#C0362A] hover:underline">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-[10px] bg-[#C0362A] text-white text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
