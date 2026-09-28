// Shared body of the type-of-work landings (lib/seo/intent-landings.ts):
// /trabajo-remoto, /trabajo-sin-experiencia, /trabajo-medio-tiempo.
//
// Same shape as the city and category landings — breadcrumb, h1, the jobs in
// that slice (paginated, through lib/data.ts), ItemList + BreadcrumbList —
// plus an editorial guide below the list, because each of these pages answers
// a question ("¿cómo consigo trabajo remoto desde Paraguay?") as well as
// listing jobs. That copy is also why the page stays indexable while the list
// is empty: it is a guide with a job list, not a thin filter page.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJobs } from '@/lib/data';
import type { JobFilters } from '@/lib/types';
import { JOBS_PAGE_SIZE } from '@/lib/pagination';
import { siteUrl } from '@/lib/seo';
import { INTENT_LANDINGS, INTENT_LANDING_ORDER, type IntentLandingKey } from '@/lib/seo/intent-landings';
import JobCard from '@/components/JobCard';
import Pagination from '@/components/Pagination';
import JsonLd from '@/components/JsonLd';
import type { FaqItem } from '@/components/guide/GuidePage';

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export function pageFromSearchParams(sp: { [key: string]: string | string[] | undefined }): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : 1;
}

/** The lib/data.ts filter for a landing — the URL param names differ from JobFilters'. */
export function intentJobFilters(key: IntentLandingKey): JobFilters {
  const { filter } = INTENT_LANDINGS[key];
  if (filter.param === 'modalidad') return { modality: filter.value };
  if (filter.param === 'nivel') return { nivel: filter.value };
  return { tipo: filter.value };
}

type Props = {
  landing: IntentLandingKey;
  h1: string;
  intro: ReactNode;
  /** Shown instead of the list when the slice is empty. */
  emptyText: string;
  searchParams: { [key: string]: string | string[] | undefined };
  /** The editorial guide under the list. */
  children: ReactNode;
  faq?: FaqItem[];
};

export default async function IntentLanding({ landing, h1, intro, emptyText, searchParams, children, faq = [] }: Props) {
  const entry = INTENT_LANDINGS[landing];
  const page = pageFromSearchParams(searchParams);
  const { jobs, total } = await getJobs({ ...intentJobFilters(landing), orden: 'recientes', page });

  // Past the last page is a 404, not an empty indexable 200 — same rule as
  // the city and category landings.
  if (page > 1 && jobs.length === 0) notFound();

  const site = siteUrl();
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${site}/empleos` },
      { '@type': 'ListItem', position: 3, name: entry.label, item: `${site}${entry.path}` },
    ],
  };
  const itemListJsonLd =
    jobs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: h1,
          numberOfItems: jobs.length,
          itemListElement: jobs.map((job, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${site}/empleos/${job.slug}`,
            name: job.title,
          })),
        }
      : null;
  const faqJsonLd =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }
      : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {itemListJsonLd && <JsonLd data={itemListJsonLd} />}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-brand">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link href="/empleos" className="hover:text-brand">Empleos</Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium">{entry.label}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-ink">
            {h1}
            {page > 1 && <span className="text-ink-3 font-medium text-2xl"> · página {page}</span>}
          </h1>
          <div className="mt-3 text-base text-ink-secondary max-w-3xl">{intro}</div>
          {total > 0 && (
            <p className="mt-2 text-sm font-medium text-ink">
              {total === 1 ? '1 empleo publicado' : `${total} empleos publicados`}
            </p>
          )}
        </div>

        <ul className="mb-8 flex flex-wrap gap-2" aria-label="Otros tipos de trabajo">
          {INTENT_LANDING_ORDER.filter((k) => k !== landing).map((k) => (
            <li key={k}>
              <Link
                href={INTENT_LANDINGS[k].path}
                className="inline-flex items-center px-3.5 py-2 rounded-full border border-border bg-white text-sm text-ink-secondary hover:border-brand hover:text-brand transition-colors"
              >
                {INTENT_LANDINGS[k].label}
              </Link>
            </li>
          ))}
        </ul>

        {jobs.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-[10px] border border-border">
            <p className="text-ink-secondary">
              {emptyText}{' '}
              <Link href="/empleos" className="text-brand hover:underline">
                Ver todos los empleos
              </Link>
            </p>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Empleos publicados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
            <Pagination
              basePath={entry.path}
              currentPage={page}
              totalPages={Math.ceil(total / JOBS_PAGE_SIZE)}
              searchParams={searchParams}
            />
          </>
        )}

        {page === 1 && (
          <div className="prose-guide mt-12 pt-8 border-t border-border max-w-3xl">
            {children}
            {faq.length > 0 && (
              <section aria-labelledby="preguntas-frecuentes">
                <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
                {faq.map((item) => (
                  <div key={item.q}>
                    <h3>{item.q}</h3>
                    <p>{item.a}</p>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
