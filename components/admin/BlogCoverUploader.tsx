'use client';

import { useRef, useState } from 'react';

type Props = {
  postId: number;
  initialUrl: string | null;
  initialAlt: string | null;
};

/**
 * Alt text is typed BEFORE the file picker opens, and the upload request
 * carries it. That ordering is the whole design: the API refuses an upload
 * without alt text, so an image with no description is not a state either side
 * can produce — rather than a validation someone can dismiss and forget.
 */
export default function BlogCoverUploader({ postId, initialUrl, initialAlt }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [alt, setAlt] = useState(initialAlt ?? '');
  const [savedAlt, setSavedAlt] = useState(initialAlt ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const altReady = alt.trim().length > 0;

  async function handleFile(file: File) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/blog/${postId}/portada?alt=${encodeURIComponent(alt.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir la portada.');
        return;
      }
      setUrl(data.url);
      setSavedAlt(data.alt);
      setNotice('Portada actualizada.');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleAltSave() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/portada`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: alt.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el texto alternativo.');
        return;
      }
      setSavedAlt(alt.trim());
      setNotice('Texto alternativo guardado.');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar la portada de este artículo?')) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/portada`, { method: 'DELETE' });
      if (!res.ok) {
        setError('No se pudo eliminar la portada.');
        return;
      }
      setUrl(null);
      setAlt('');
      setSavedAlt('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {url && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- PLAN-IMAGES.md §6: one stored size, no next/image loader */}
          <img
            src={url}
            alt={savedAlt}
            className="w-full max-w-md aspect-video object-cover rounded-[10px] border border-[#E7E1D6]"
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mt-2 text-sm font-medium text-[#B42318] hover:underline disabled:opacity-60"
          >
            Eliminar portada
          </button>
        </div>
      )}

      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
        Texto alternativo<span className="text-[#B42318] ml-0.5">*</span>
      </label>
      <input
        type="text"
        value={alt}
        maxLength={200}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="Persona revisando un currículum impreso sobre un escritorio"
        className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
      />
      <p className="text-xs text-[#8A8378] mt-1">
        Describí la imagen para quien no puede verla. Es obligatorio y también lo lee Google.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label
          className={`inline-flex items-center gap-2 text-sm font-medium ${
            altReady && !busy
              ? 'cursor-pointer text-[#C0362A] hover:underline'
              : 'cursor-not-allowed text-[#8A8378]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={!altReady || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {busy ? 'Subiendo...' : url ? 'Reemplazar imagen' : 'Subir imagen'}
        </label>

        {url && alt.trim() !== savedAlt && (
          <button
            type="button"
            onClick={handleAltSave}
            disabled={!altReady || busy}
            className="text-sm font-medium text-[#C0362A] hover:underline disabled:opacity-60"
          >
            Guardar texto alternativo
          </button>
        )}
      </div>

      {!altReady && (
        <p className="text-xs text-[#8A8378] mt-1">
          Escribí el texto alternativo para habilitar la subida.
        </p>
      )}
      <p className="text-xs text-[#8A8378] mt-1">
        JPG, PNG o WebP, máximo 4 MB. Se convierte a WebP automáticamente. Se usa como imagen de
        portada del artículo y en la vista previa al compartir.
      </p>

      {error && <p className="text-sm text-[#B42318] mt-2">{error}</p>}
      {notice && <p className="text-sm text-[#2E7D32] mt-2">{notice}</p>}
    </div>
  );
}
