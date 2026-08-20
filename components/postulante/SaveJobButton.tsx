'use client';

import { useState } from 'react';

type Props = { jobSlug: string; initialSaved: boolean };

export default function SaveJobButton({ jobSlug, initialSaved }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    const method = saved ? 'DELETE' : 'POST';
    try {
      const res = await fetch('/api/postulante/guardados', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobSlug }),
      });
      if (res.ok) setSaved(!saved);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={submitting}
      aria-pressed={saved}
      className={`w-full py-2.5 px-6 rounded-[10px] font-semibold text-sm transition-colors disabled:opacity-60 border ${
        saved
          ? 'bg-brand-tint border-brand/30 text-brand'
          : 'bg-white border-border text-ink hover:border-brand hover:text-brand'
      }`}
    >
      {saved ? '★ Guardado' : '☆ Guardar'}
    </button>
  );
}
