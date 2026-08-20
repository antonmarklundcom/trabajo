'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployerInvitationForm({ companyId }: { companyId: number }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setInviteUrl('');

    try {
      const res = await fetch(`/api/admin/empresas/${companyId}/invitaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo generar la invitación.');
        setSubmitting(false);
        return;
      }
      setInviteUrl(data.inviteUrl);
      setEmail('');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="email@empresa.py"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {submitting ? 'Generando...' : 'Invitar usuario'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>
      )}

      {inviteUrl && (
        <div className="rounded-[10px] border border-border bg-surface-2 p-4 space-y-2">
          <p className="text-sm text-ink">
            Enlace generado — copialo y enviaselo al empleador. No se va a volver a mostrar.
          </p>
          <input
            type="text"
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.target.select()}
            className="w-full px-3 py-2 rounded-[10px] border border-border text-xs text-ink-secondary bg-white"
          />
        </div>
      )}
    </div>
  );
}
