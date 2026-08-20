'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'published', label: 'Publicado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'archived', label: 'Archivado' },
];

export default function EmpleosFilterBar({
  status,
  q,
}: {
  status: string;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(q);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam('q', term);
        }}
        className="flex-1 flex gap-2"
      >
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por título o empresa..."
          className="flex-1 px-4 py-2 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-[10px] border border-border text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors"
        >
          Buscar
        </button>
      </form>
      <select
        value={status}
        onChange={(e) => updateParam('status', e.target.value)}
        className="px-3 py-2 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
