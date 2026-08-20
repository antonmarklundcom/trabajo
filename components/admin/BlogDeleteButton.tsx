'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Deleting an article is a hard delete of a URL that may be indexed. The
 * confirmation names the slug rather than saying "¿Estás seguro?", so the thing
 * being destroyed is visible at the moment of destroying it.
 */
export default function BlogDeleteButton({ postId, slug }: { postId: number; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!confirm(`¿Eliminar el artículo /blog/${slug}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'No se pudo eliminar el artículo.');
        setBusy(false);
        return;
      }
      router.push('/admin/blog');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-sm font-medium text-error hover:underline disabled:opacity-60"
      >
        {busy ? 'Eliminando...' : 'Eliminar artículo'}
      </button>
      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}
