'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { POLICY_VERSION } from '@/lib/policy';

type Props = { token: string; email: string; companyName: string };

export default function ActivationForm({ token, email, companyName }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!termsAccepted) {
      setError('Tenés que aceptar los términos para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/empresa/activar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password, termsAccepted }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo activar la cuenta.');
        setSubmitting(false);
        return;
      }
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : '/empresa');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="rounded-[10px] bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
        Activando la cuenta de <span className="font-medium text-ink">{companyName}</span> para{' '}
        <span className="font-medium text-ink">{email}</span>.
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Tu nombre</label>
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Confirmar contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-brand focus:ring-brand"
        />
        <span>
          Acepto los{' '}
          <Link href="/terminos" target="_blank" className="text-brand hover:underline">
            términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" target="_blank" className="text-brand hover:underline">
            política de privacidad
          </Link>{' '}
          de trabajo.com.py como empresa anunciante, incluyendo que trabajo.com.py no selecciona,
          evalúa ni recomienda candidatos, y que mi empresa es responsable del tratamiento de los
          datos de los postulantes que reciba.
        </span>
      </label>
      <p className="text-xs text-ink-3">
        Versión de la política: {POLICY_VERSION}
      </p>

      {error && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Activando...' : 'Activar cuenta'}
      </button>
    </form>
  );
}
