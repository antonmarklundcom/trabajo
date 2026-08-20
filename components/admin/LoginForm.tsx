'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo iniciar sesión.');
        setSubmitting(false);
        return;
      }
      // Destination comes from the server, which knows the role; an employer
      // logging in here belongs on /empresa, not /admin.
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : '/admin');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {error && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}
