'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  jobSlug: string;
  companyName: string;
  alreadyApplied: boolean;
};

export default function ApplyButton({ jobSlug, companyName, alreadyApplied }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!consentAccepted) {
      setError('Tenés que aceptar compartir tu perfil con la empresa para postularte.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/postulante/postulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobSlug,
          message: message.trim() ? message.trim() : null,
          consentAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar tu postulación.');
        setSubmitting(false);
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  if (alreadyApplied || done) {
    return (
      <div className="rounded-[10px] bg-success-tint border border-success/20 p-4 text-center text-sm text-[#1E6B3E]">
        Ya te postulaste a este empleo con tu perfil de trabajo.com.py.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors"
      >
        Postularme con mi perfil
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        rows={3}
        maxLength={1000}
        placeholder="Mensaje para la empresa (opcional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full px-3 py-2 rounded-[8px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand"
      />
      <label className="flex items-start gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-brand focus:ring-brand"
        />
        <span>
          Acepto compartir mi perfil y mi CV con <strong>{companyName}</strong> para esta
          postulación.
        </span>
      </label>

      {error && <p className="text-xs text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {submitting ? 'Enviando...' : 'Enviar postulación'}
      </button>
    </form>
  );
}
