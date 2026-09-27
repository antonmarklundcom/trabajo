'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

// Two options, because there are two orders. `recientes` and `destacados`
// run the SAME query — Destacado listings first, then newest (lib/db/queries.ts,
// the promise /planes sells: "Aparecé primero en los resultados") — and the
// control used to offer both as if they differed, labelling the first one
// "Más recientes" while older featured jobs sat on top of it. The honest name
// for featured-then-newest is "Recomendados". `?orden=destacados` URLs keep
// working (they select the same order); the control just stops pretending.
const SORT_OPTIONS = [
  { value: 'recientes', label: 'Recomendados' },
  { value: 'salario', label: 'Mayor salario' },
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
          value={currentOrden === 'salario' ? 'salario' : 'recientes'}
          onChange={handleChange}
          className="min-w-0 min-h-10 px-3 rounded-[10px] border border-border text-sm text-ink bg-surface focus:outline-none focus:border-brand"
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
