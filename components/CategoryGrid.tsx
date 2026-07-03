import Link from 'next/link';
import type { Category } from '@/lib/types';
import { categoryLabel } from '@/lib/labels';

const categoryIcons: Record<string, React.ReactNode> = {
  contabilidad: <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  ventas: <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  administracion: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  'atencion-al-cliente': <path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  tecnologia: <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  salud: <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  gastronomia: <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  logistica: <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  construccion: <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  marketing: <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
};

type Props = { categories: Category[] };

export default function CategoryGrid({ categories }: Props) {
  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-[#1E1B17] mb-6">
          Explorá por categoría
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const empty = cat.jobCount === 0;
            return (
              <Link
                key={cat.slug}
                href={`/trabajo/${cat.slug}`}
                className={`group flex flex-col gap-3 p-4 rounded-[14px] border transition-all ${
                  empty
                    ? 'border-dashed border-[#D8D0C2] bg-transparent hover:border-[#B0812C]'
                    : 'border-[#E7E1D6] bg-white hover:border-[#C0362A] hover:shadow-[0_4px_12px_-2px_rgba(30,27,23,.1)]'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center rounded-[12px] transition-colors ${
                    empty
                      ? 'bg-[#F5F1EA] text-[#8A8378]'
                      : 'bg-[#FBECE9] text-[#C0362A]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    {categoryIcons[cat.slug] ?? (
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    )}
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E1B17] leading-tight">
                    {categoryLabel(cat.slug)}
                  </p>
                  {cat.jobCount !== undefined && (
                    <p className={`text-xs mt-0.5 ${empty ? 'font-semibold text-[#8F6620]' : 'text-[#8A8378]'}`}>
                      {empty
                        ? 'Sé el primero →'
                        : `${cat.jobCount} ${cat.jobCount === 1 ? 'empleo' : 'empleos'}`}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
