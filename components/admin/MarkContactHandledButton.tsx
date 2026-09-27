'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MarkContactHandledButton({ id }: { id: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/mensajes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handled: true }),
      });
      // 409 means someone else marked it first: the refresh shows who.
      if (!res.ok && res.status !== 409) throw new Error();
      router.refresh();
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="px-3 py-1.5 rounded-[10px] text-xs font-medium border border-border text-ink-secondary hover:border-brand hover:text-brand transition-colors disabled:opacity-60 whitespace-nowrap"
      >
        {saving ? 'Guardando…' : 'Marcar como atendido'}
      </button>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
