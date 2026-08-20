'use client';

import { useRef, useState } from 'react';

export type JobImage = { id: number; url: string; width: number; height: number };

const MAX_IMAGES = 3;

export default function JobImageUploader({
  jobId,
  initialImages,
}: {
  jobId: number;
  initialImages: JobImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<JobImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/empleos/${jobId}/imagenes`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir la imagen.');
        return;
      }
      setImages((prev) => [...prev, data]);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(imageId: number) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    const res = await fetch(`/api/admin/empleos/${jobId}/imagenes/${imageId}`, {
      method: 'DELETE',
    });
    if (res.ok) setImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element -- PLAN-IMAGES.md §6: one stored size, no next/image loader */}
              <img
                src={img.url}
                alt=""
                className="w-full aspect-video object-cover rounded-[10px] border border-border"
              />
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white text-error rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm"
                aria-label="Eliminar imagen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < MAX_IMAGES && (
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-brand hover:underline">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploading ? 'Subiendo...' : 'Agregar imagen'}
        </label>
      )}
      <p className="text-xs text-ink-3 mt-1">
        JPG, PNG o WebP. Máximo 4 MB. Hasta {MAX_IMAGES} imágenes.
      </p>

      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}
