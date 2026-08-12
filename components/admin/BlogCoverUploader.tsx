'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type BlogCoverInitial = { url: string; alt: string; width: number; height: number } | null;

export default function BlogCoverUploader({
  postId,
  initial,
}: {
  postId: number;
  initial: BlogCoverInitial;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<BlogCoverInitial>(initial);
  const [alt, setAlt] = useState(initial?.alt ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError('');
    if (!alt.trim()) {
      setError('Escribí el texto alternativo antes de subir la imagen — describí la foto, en español.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/portada`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Cover-Alt': alt.trim(),
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir la portada.');
        return;
      }
      setCover(data);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!confirm('¿Quitar la portada?')) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog/${postId}/portada`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) {
      setCover(null);
      router.refresh();
    }
  }

  return (
    <div>
      {cover && (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- PLAN-IMAGES.md §6: one stored size, no next/image loader */}
          <img
            src={cover.url}
            alt={cover.alt}
            className="w-full max-w-md aspect-video object-cover rounded-[10px] border border-[#E7E1D6]"
          />
        </div>
      )}

      <div className="max-w-md">
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
          Texto alternativo <span className="text-[#B42318] ml-0.5">*</span>
        </label>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Describí la imagen, en español"
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20 mb-3"
        />

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-[#C0362A] hover:underline">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {busy ? 'Subiendo...' : cover ? 'Reemplazar portada' : 'Subir portada'}
          </label>
          {cover && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="text-sm font-medium text-[#B42318] hover:underline disabled:opacity-60"
            >
              Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-[#8A8378] mt-1">
          JPG, PNG o WebP. Máximo 4 MB. Se recorta automáticamente a 16:9.
        </p>
      </div>

      {error && <p className="text-sm text-[#B42318] mt-2">{error}</p>}
    </div>
  );
}
