'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type CurrentCv = { id: number; originalFilename: string; sizeBytes: number } | null;

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CvUploader({ currentCv }: { currentCv: CurrentCv }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const res = await fetch('/api/postulante/cv', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-CV-Filename': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el CV.');
        setUploading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!currentCv) return;
    if (!confirm('¿Eliminar tu CV actual?')) return;
    await fetch(`/api/postulante/cv/${currentCv.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div>
      {currentCv ? (
        <div className="flex items-center justify-between gap-3 border border-border rounded-[10px] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">{currentCv.originalFilename}</p>
            <p className="text-xs text-ink-3">{formatSize(currentCv.sizeBytes)}</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a
              href={`/api/postulante/cv/${currentCv.id}`}
              className="text-xs text-ink-secondary hover:text-brand"
            >
              Ver
            </a>
            <button onClick={handleDelete} className="text-xs text-error hover:underline">
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary mb-2">Todavía no subiste tu CV.</p>
      )}

      <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-brand hover:underline">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {uploading ? 'Subiendo...' : currentCv ? 'Reemplazar CV' : 'Subir CV'}
      </label>
      <p className="text-xs text-ink-3 mt-1">PDF, DOC o DOCX. Máximo 5 MB.</p>

      {error && <p className="text-sm text-error mt-2">{error}</p>}
    </div>
  );
}
