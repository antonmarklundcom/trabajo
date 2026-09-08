import { Suspense } from 'react';
import Link from 'next/link';
import { getCategories } from '@/lib/data';
import SearchBar from '@/components/SearchBar';

/**
 * A true 404 — a URL that never existed, or one whose listing was deleted
 * outright (an expired or archived listing gets the tombstone in
 * app/empleos/[slug]/page.tsx instead).
 *
 * Two links out was a dead end for the visitor and a dead end for the crawler.
 * The search box and the category list give both somewhere to go, and the
 * category links are the same crawlable tier the listing page feeds
 * (PLAN-GROWTH.md §4 S3).
 */
export default async function NotFound() {
  const categories = await getCategories();
  const withJobs = categories.filter((c) => (c.jobCount ?? 0) > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <div className="text-6xl font-bold text-border mb-4">404</div>
        <h1 className="text-2xl font-bold text-ink mb-3">Página no encontrada</h1>
        <p className="text-ink-secondary max-w-md mx-auto">
          La página que buscás no existe o fue movida. Pero hay muchos empleos esperándote.
        </p>
      </div>

      {/*
        useSearchParams inside a statically rendered route must sit under a
        Suspense boundary or the production build fails
        (node_modules/next/dist/docs .../use-search-params.md). This page is
        static, so the boundary is required, not hygiene.
      */}
      <div className="mt-8">
        <Suspense fallback={<div className="h-[58px] rounded-[10px] border border-border bg-white" />}>
          <SearchBar initialQ="" />
        </Suspense>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/empleos"
          className="px-6 py-3 rounded-[10px] bg-brand text-white font-semibold text-center hover:bg-brand-hover transition-colors"
        >
          Ver todos los empleos
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-[10px] border-2 border-brand text-brand font-semibold text-center hover:bg-brand-tint transition-colors"
        >
          Ir al inicio
        </Link>
      </div>

      {withJobs.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-ink mb-4">Explorá por categoría</h2>
          <ul className="flex flex-wrap gap-2">
            {withJobs.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/trabajo/${cat.slug}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-white text-sm text-ink-secondary hover:border-brand hover:text-brand transition-colors"
                >
                  {cat.name}
                  <span className="text-xs text-ink-3">{cat.jobCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
