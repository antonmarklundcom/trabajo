'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { City } from '@/lib/types';
import { categoryLabel } from '@/lib/labels';
import { NandutiMotif } from './Logo';

type Props = { cities: City[] };

export default function SearchHero({ cities }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [keyword, setKeyword] = useState('');
  const [ciudad, setCiudad] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (ciudad) params.set('ciudad', ciudad);
    startTransition(() => {
      router.push(`/empleos?${params.toString()}`);
    });
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-hover px-4 py-14 sm:py-20">
      <NandutiMotif className="pointer-events-none absolute -right-24 -top-24 w-[26rem] h-[26rem] text-white opacity-[0.12]" />
      <NandutiMotif className="pointer-events-none absolute -left-40 bottom-[-14rem] w-[30rem] h-[30rem] text-white opacity-[0.07]" />

      <div className="relative max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-white leading-[1.03]">
          Encontrá tu próximo trabajo en Paraguay
        </h1>
        <p className="mt-4 text-base sm:text-lg text-white/85 max-w-2xl">
          El portal de empleos hecho para el móvil. Postulate en un toque por WhatsApp.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 bg-white rounded-[16px] p-2 flex flex-col sm:flex-row gap-2 shadow-[0_18px_40px_-16px_rgba(30,27,23,.45)]"
          role="search"
        >
          {/* Keyword field */}
          <div className="flex-1 flex items-center gap-2 px-3">
            <svg
              className="text-ink-3 flex-shrink-0"
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
              placeholder="Buscá por cargo o empresa"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full py-3 text-base text-ink placeholder-ink-3 bg-transparent border-none outline-none"
              aria-label="Buscar empleo"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border my-2" aria-hidden="true" />

          {/* City select */}
          <div className="flex items-center gap-2 px-3 sm:w-52">
            <svg
              className="text-ink-3 flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <select
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="w-full py-3 text-base text-ink bg-transparent border-none outline-none cursor-pointer"
              aria-label="Filtrar por ciudad"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="px-7 py-3 rounded-[12px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors whitespace-nowrap"
          >
            Buscar
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-white/75">Populares:</span>
          {['tecnologia', 'ventas', 'administracion', 'salud'].map((cat) => (
            <a
              key={cat}
              href={`/trabajo/${cat}`}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium text-white bg-white/12 border border-white/20 hover:bg-white/20 transition-colors"
            >
              {categoryLabel(cat)}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
