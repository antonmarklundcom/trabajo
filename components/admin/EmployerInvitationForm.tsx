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
          className="flex-1 px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2.5 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {submitting ? 'Generando...' : 'Invitar usuario'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}

      {inviteUrl && (
        <div className="rounded-[10px] border border-[#E7E1D6] bg-[#F5F1EA] p-4 space-y-2">
          <p className="text-sm text-[#1E1B17]">
            Enlace generado — copialo y enviaselo al empleador. No se va a volver a mostrar.
          </p>
          <input
            type="text"
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.target.select()}
            className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-xs text-[#57514A] bg-white"
          />
        </div>
      )}
    </div>
  );
}
