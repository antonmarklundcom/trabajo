'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nueva' },
  { value: 'reviewed', label: 'Revisada' },
  { value: 'contacted', label: 'Contactada' },
  { value: 'hired', label: 'Contratada' },
  { value: 'discarded', label: 'Descartada' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-gold-tint text-gold-strong',
  reviewed: 'bg-[#EAF1FB] text-[#2B5DA8]',
  contacted: 'bg-success-tint text-success',
  hired: 'bg-success-tint text-success',
  discarded: 'bg-surface-2 text-ink-3',
};

export default function ApplicationStatusSelect({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/empresa/postulaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setValue(status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${STATUS_STYLES[value] ?? 'bg-surface-2 text-ink-secondary'}`}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
