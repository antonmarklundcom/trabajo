'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      const res = await fetch('/api/postulante/login', {
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
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-center text-sm text-[#57514A]">
        ¿No tenés cuenta?{' '}
        <Link href="/postulante/registro" className="text-[#C0362A] hover:underline">
          Creá una
        </Link>
      </p>
    </form>
  );
}
