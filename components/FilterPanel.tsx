'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { Category, City } from '@/lib/types';

type Props = {
  categories: Category[];
  cities: City[];
  currentFilters: {
    categoria?: string;
    ciudad?: string;
    tipo?: string;
    nivel?: string;
    modalidad?: string;
    salario_min?: string;
    orden?: string;
    q?: string;
  };
};

const CONTRATO_OPTIONS = [
  { value: 'tiempo_completo', label: 'Tiempo completo' },
  { value: 'medio_tiempo', label: 'Medio tiempo' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'pasantia', label: 'Pasantía' },
  { value: 'freelance', label: 'Freelance' },
];

const NIVEL_OPTIONS = [
  { value: 'sin_experiencia', label: 'Sin experiencia' },
  { value: 'junior', label: 'Junior' },
  { value: 'semi_senior', label: 'Semi Senior' },
  { value: 'senior', label: 'Senior' },
];

const MODALIDAD_OPTIONS = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
];

const SALARIO_OPTIONS = [
  { value: '2000000', label: 'Gs. 2.000.000+' },
  { value: '3000000', label: 'Gs. 3.000.000+' },
  { value: '5000000', label: 'Gs. 5.000.000+' },
  { value: '8000000', label: 'Gs. 8.000.000+' },
];

export default function FilterPanel({ categories, cities, currentFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page'); // reset pagination on filter change
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    const q = searchParams.get('q');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [router, pathname, searchParams]);

  const hasActiveFilters =
    currentFilters.categoria ||
    currentFilters.ciudad ||
    currentFilters.tipo ||
    currentFilters.nivel ||
    currentFilters.modalidad ||
    currentFilters.salario_min;

  const filterContent = (
    <div className="space-y-6">
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-[#C0362A] hover:underline font-medium"
        >
          Limpiar filtros
        </button>
      )}

      <FilterSection label="Categoría">
        <select
          value={currentFilters.categoria ?? ''}
          onChange={(e) => updateFilter('categoria', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection label="Ciudad">
        <select
          value={currentFilters.ciudad ?? ''}
          onChange={(e) => updateFilter('ciudad', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Todas</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection label="Tipo de contrato">
        <select
          value={currentFilters.tipo ?? ''}
          onChange={(e) => updateFilter('tipo', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Todos</option>
          {CONTRATO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection label="Nivel de experiencia">
        <select
          value={currentFilters.nivel ?? ''}
          onChange={(e) => updateFilter('nivel', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Todos</option>
          {NIVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection label="Modalidad">
        <select
          value={currentFilters.modalidad ?? ''}
          onChange={(e) => updateFilter('modalidad', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Todas</option>
          {MODALIDAD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection label="Salario mínimo">
        <select
          value={currentFilters.salario_min ?? ''}
          onChange={(e) => updateFilter('salario_min', e.target.value)}
          className="w-full px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
        >
          <option value="">Sin mínimo</option>
          {SALARIO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E7E1D6] bg-white text-sm font-medium text-[#1E1B17] hover:border-[#C0362A] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 w-2 h-2 rounded-full bg-[#C0362A]" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-5 sticky top-24">
          <h2 className="text-sm font-semibold text-[#1E1B17] mb-4">Filtros</h2>
          {filterContent}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-6 lg:hidden max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-[#1E1B17]">Filtros</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F1EA] text-[#57514A] hover:bg-[#E7E1D6] transition-colors"
                aria-label="Cerrar filtros"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
            {filterContent}
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-6 w-full py-3 rounded-[10px] bg-[#C0362A] text-white font-semibold hover:bg-[#9E2A20] transition-colors"
            >
              Ver resultados
            </button>
          </div>
        </>
      )}
    </>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-[#57514A] mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
