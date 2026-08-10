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
          ? 'bg-[#FBECE9] border-[#C0362A]/30 text-[#C0362A]'
          : 'bg-white border-[#E7E1D6] text-[#1E1B17] hover:border-[#C0362A] hover:text-[#C0362A]'
      }`}
    >
      {saved ? '★ Guardado' : '☆ Guardar'}
    </button>
  );
}
