'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  companyName: string;
  logoSrc: string | null;
  uploadUrl: string;
};

// File picker + upload button for a company logo. Uploads and removals hit
// the route immediately (not gated behind the surrounding form's Save
// button) and then router.refresh() so the server recomputes logoSrc from
// the row it just wrote. No drag-and-drop, no cropper — PLAN-IMAGES.md §6.
export default function LogoUploader({ companyName, logoSrc, uploadUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el logo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(uploadUrl, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo quitar el logo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Logo</label>
      <div className="flex items-center gap-4">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`Logo de ${companyName}`}
            width={64}
            height={64}
            className="w-16 h-16 rounded-[10px] border border-[#E7E1D6] object-cover bg-white flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-[10px] border border-dashed border-[#E7E1D6] flex items-center justify-center text-xs text-[#8A8378] text-center flex-shrink-0">
            Sin logo
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="text-sm text-[#57514A] disabled:opacity-60"
          />
          {logoSrc && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="text-sm text-[#B42318] hover:underline self-start disabled:opacity-60"
            >
              Quitar logo
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-[#B42318] mt-2">{error}</p>}
      <p className="text-xs text-[#8A8378] mt-1.5">JPG, PNG o WebP. Máximo 4 MB.</p>
    </div>
  );
}
