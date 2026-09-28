'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { City } from '@/lib/types';
import { categoryLabel } from '@/lib/labels';
import { NandutiMotif } from './Logo';

type Props = {
  cities: City[];
  /** Live listing count, for the trust line. Omitted from the line when 0. */
  activeJobCount: number;
  /** Cities that currently have at least one listing. */
  activeCityCount: number;
};

export default function SearchHero({ cities, activeJobCount, activeCityCount }: Props) {
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

  // Compact on a phone, on purpose: the old hero filled the whole first
  // screen (heading, stacked keyword + city + button, a wrapped chip cloud)
  // so a seeker saw no job until they scrolled. Now it is one search row and
  // one scrollable chip row, and the newest jobs start on the first screen.
  // The city select appears from `sm`; on a phone city is one tap away on
  // /empleos, and a third stacked control cost more than it gave.
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-hover px-4 pt-7 pb-6 sm:py-16">
      <NandutiMotif className="pointer-events-none absolute -right-24 -top-24 w-[26rem] h-[26rem] text-white opacity-[0.12]" />
      <NandutiMotif className="pointer-events-none absolute -left-40 bottom-[-14rem] w-[30rem] h-[30rem] text-white opacity-[0.07]" />

      <div className="relative max-w-4xl mx-auto">
        <h1 className="text-[2rem] sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-white leading-[1.05] text-balance">
          Encontrá tu próximo trabajo en Paraguay
        </h1>
        <p className="mt-2.5 sm:mt-4 text-[15px] sm:text-lg text-white/85 max-w-2xl">
          La bolsa de trabajo de Paraguay. Postulate gratis, en un toque, por WhatsApp.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 sm:mt-8 bg-white rounded-[14px] sm:rounded-[16px] p-1.5 sm:p-2 flex gap-1.5 sm:gap-2 shadow-[0_18px_40px_-16px_rgba(30,27,23,.45)]"
          role="search"
        >
          {/* Keyword field */}
          <div className="flex-1 min-w-0 flex items-center gap-2 px-2.5 sm:px-3">
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
              type="search"
              enterKeyHint="search"
              placeholder="Cargo o empresa"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full min-w-0 py-3 text-base text-ink placeholder-ink-3 bg-transparent border-none outline-none"
              aria-label="Buscar empleo"
            />
          </div>

          {/* City select — from `sm` up */}
          <div className="hidden sm:block w-px bg-border my-2" aria-hidden="true" />
          <div className="hidden sm:flex items-center gap-2 px-3 w-52">
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

          <button
            type="submit"
            className="flex-shrink-0 px-5 sm:px-7 min-h-12 rounded-[10px] sm:rounded-[12px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors whitespace-nowrap"
          >
            Buscar
          </button>
        </form>

        {/* One scrollable row on a phone instead of a three-line chip cloud. */}
        <div className="mt-4 sm:mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="flex-shrink-0 text-sm text-white/75">Populares:</span>
          {['tecnologia', 'ventas', 'administracion', 'salud'].map((cat) => (
            <Link
              key={cat}
              href={`/trabajo/${cat}`}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium text-white bg-white/12 border border-white/20 hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              {categoryLabel(cat)}
            </Link>
          ))}
        </div>

        {/* Trust line — only numbers the site itself can source, and none at
            all rather than a "0 empleos" that argues against us. */}
        <p className="mt-4 sm:mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] sm:text-sm text-white/80">
          {activeJobCount > 0 && (
            <>
              <span><strong className="font-semibold text-white">{activeJobCount}</strong> {activeJobCount === 1 ? 'empleo activo' : 'empleos activos'}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          {activeCityCount > 1 && (
            <>
              <span>en <strong className="font-semibold text-white">{activeCityCount}</strong> ciudades</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>Gratis para postulantes, siempre</span>
        </p>
      </div>
    </section>
  );
}
