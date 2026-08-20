'use client';

import { useState } from 'react';
import Link from 'next/link';

const INPUT =
  'w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function ResetRequestForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/postulante/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar el enlace.');
        setSubmitting(false);
        return;
      }
      // The server answers the same way whether or not the address has an
      // account, and so does this screen — the form is replaced rather than
      // left open, so nothing about the outcome can be read from its state.
      setSent(data.message);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">{sent}</p>
        <p className="text-sm text-ink-secondary">
          Revisá tu correo. El enlace vence en 30 minutos.
        </p>
        <Link href="/postulante/login" className="block text-sm text-brand hover:underline">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Escribí tu email y te enviamos un enlace para elegir una contraseña nueva.
      </p>
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
      </div>
      {error && <p className="text-sm text-brand">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-[10px] bg-brand text-white text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <Link href="/postulante/login" className="block text-center text-sm text-ink-secondary hover:underline">
        Volver a ingresar
      </Link>
    </form>
  );
}
