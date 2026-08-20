'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UnsaveJobButton({ jobSlug }: { jobSlug: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleUnsave() {
    setSubmitting(true);
    await fetch('/api/postulante/guardados', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobSlug }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={handleUnsave}
      disabled={submitting}
      className="text-xs text-error hover:underline disabled:opacity-60"
    >
      {submitting ? 'Quitando...' : 'Quitar de guardados'}
    </button>
  );
}
