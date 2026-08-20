'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type Props = { initialQ: string };

export default function SearchBar({ initialQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set('q', q.trim());
    } else {
      params.delete('q');
    }
    params.delete('page');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 bg-white border border-border rounded-[10px] p-2"
      role="search"
    >
      <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
        <svg
          className="text-ink-secondary flex-shrink-0"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cargo, empresa o palabra clave..."
          className="flex-1 min-w-0 py-2 text-base text-ink placeholder-ink-3 bg-transparent border-none outline-none"
          aria-label="Buscar empleos"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="text-ink-3 hover:text-ink-secondary transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        className="flex-shrink-0 px-5 py-2 rounded-[8px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm whitespace-nowrap transition-colors"
      >
        Buscar
      </button>
    </form>
  );
}
