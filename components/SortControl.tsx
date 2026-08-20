'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const SORT_OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'destacados', label: 'Destacados primero' },
  { value: 'salario', label: 'Mayor salario' },
  { value: 'relevancia', label: 'Relevancia' },
];

type Props = { currentOrden: string; total: number };

export default function SortControl({ currentOrden, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('orden', e.target.value);
    params.delete('page');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink">{total}</span>{' '}
        {total === 1 ? 'empleo encontrado' : 'empleos encontrados'}
      </p>
      <div className="flex items-center gap-2 min-w-0">
        <label className="text-sm text-ink-secondary flex-shrink-0" htmlFor="sort-select">
          Ordenar:
        </label>
        <select
          id="sort-select"
          value={currentOrden}
          onChange={handleChange}
          className="min-w-0 px-3 py-1.5 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
