'use client';

import { useRef, useState } from 'react';

type Props = {
  imageKey: string | null;
  imageUrl: string | null;
  onChange: (result: { key: string; url: string } | null) => void;
};

export default function FeaturedImagePicker({ imageKey, imageUrl, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/blog/images', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo subir la imagen.');
      onChange({ key: data.key, url: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {imageUrl ? (
        <div className="relative w-full max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Imagen destacada"
            className="w-full aspect-video object-cover rounded-[10px] border border-[#E7E1D6]"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 px-2 py-1 rounded-[6px] bg-white/90 border border-[#E7E1D6] text-xs font-medium text-[#B42318] hover:bg-white"
          >
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xs aspect-video rounded-[10px] border-2 border-dashed border-[#E7E1D6] text-sm text-[#57514A] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors disabled:opacity-60"
        >
          {uploading ? 'Subiendo...' : '+ Subir imagen destacada'}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="mt-2 text-sm text-[#B42318]">{error}</p>}
      {imageKey && <input type="hidden" value={imageKey} readOnly />}
    </div>
  );
}
