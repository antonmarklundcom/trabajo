'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { City } from '@/lib/types';
import { categoryLabel } from '@/lib/labels';

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
    <section className="bg-[#2557D6] py-16 sm:py-20 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
          Encontrá tu próximo empleo en Paraguay
        </h1>
        <p className="mt-4 text-base sm:text-lg text-blue-100">
          Miles de oportunidades laborales en todo el país. Gratis para candidatos.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 bg-white rounded-[10px] p-2 flex flex-col sm:flex-row gap-2 shadow-lg"
          role="search"
        >
          {/* Keyword field */}
          <div className="flex-1 flex items-center gap-2 px-3">
            <svg
              className="text-[#5B6472] flex-shrink-0"
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
              placeholder="Cargo, empresa o palabra clave"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full py-3 text-base text-[#16181D] placeholder-[#5B6472] bg-transparent border-none outline-none"
              aria-label="Buscar empleo"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-[#E5E7EB] my-2" aria-hidden="true" />

          {/* City select */}
          <div className="flex items-center gap-2 px-3 sm:w-52">
            <svg
              className="text-[#5B6472] flex-shrink-0"
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
              className="w-full py-3 text-base text-[#16181D] bg-transparent border-none outline-none cursor-pointer"
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
            className="px-6 py-3 rounded-[8px] bg-[#2557D6] hover:bg-[#1E47B8] text-white font-semibold text-base transition-colors whitespace-nowrap"
          >
            Buscar empleos
          </button>
        </form>

        <p className="mt-4 text-sm text-blue-100">
          Popular:{' '}
          {['tecnologia', 'ventas', 'administracion', 'salud'].map((cat, i, arr) => (
            <span key={cat}>
              <a
                href={`/trabajo/${cat}`}
                className="underline underline-offset-2 hover:text-white transition-colors"
              >
                {categoryLabel(cat)}
              </a>
              {i < arr.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
