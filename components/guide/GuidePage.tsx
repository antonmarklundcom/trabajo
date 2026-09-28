// Shared frame for the resource guides in lib/guides.ts: breadcrumb, h1,
// "actualizado" line, table of contents, the page's own sections, a visible
// FAQ, related guides and a closing CTA — plus the JSON-LD that describes all
// of it (BreadcrumbList, Article, FAQPage).
//
// Each guide page owns its copy and its metadata; this component owns the
// shape, so nine pages cannot drift into nine layouts.
import type { ReactNode } from 'react';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { siteUrl } from '@/lib/seo';
import { GUIDES, type GuideKey } from '@/lib/guides';

export type FaqItem = { q: string; a: string };
export type TocItem = { id: string; label: string };

type Crumb = { label: string; href?: string };

type Props = {
  guideKey: GuideKey;
  /** The h1. */
  title: string;
  /** Same string as the meta description; used for the Article JSON-LD. */
  description: string;
  /** Crumbs between "Inicio" and this page (this page is appended). */
  parents?: Crumb[];
  /** Short breadcrumb label for this page; defaults to the registry label. */
  crumbLabel?: string;
  lede: ReactNode;
  /** Rendered between the lede and the table of contents (a calculator, a download block). */
  hero?: ReactNode;
  toc?: TocItem[];
  children: ReactNode;
  faq?: FaqItem[];
  related?: GuideKey[];
  /** Which closing call to action to show. */
  cta?: 'postulantes' | 'empresas' | 'ambos';
  /** Legal pages carry the standing "informativa" line and their sources. */
  sources?: ReactNode;
};

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatUpdated(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export default function GuidePage({
  guideKey,
  title,
  description,
  parents = [],
  crumbLabel,
  lede,
  hero,
  toc = [],
  children,
  faq = [],
  related = [],
  cta = 'postulantes',
  sources,
}: Props) {
  const entry = GUIDES[guideKey];
  const site = siteUrl();
  const url = `${site}${entry.href}`;
  const crumbs: Crumb[] = [...parents, { label: crumbLabel ?? entry.label }];

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site },
      ...crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.label,
        item: c.href ? `${site}${c.href}` : url,
      })),
    ],
  };

  const organization = {
    '@type': 'Organization',
    name: 'trabajo.com.py',
    url: site,
    logo: { '@type': 'ImageObject', url: `${site}/icon.svg` },
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: 'es-PY',
    dateModified: entry.updated,
    datePublished: entry.updated,
    mainEntityOfPage: url,
    author: organization,
    publisher: organization,
  };

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
      <JsonLd data={articleJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-brand">Inicio</Link>
          {crumbs.map((c) => (
            <span key={c.label} className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              {c.href ? (
                <Link href={c.href} className="hover:text-brand">{c.label}</Link>
              ) : (
                <span className="text-ink font-medium" aria-current="page">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <article>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink leading-tight text-balance">{title}</h1>
          <p className="mt-2 text-sm text-ink-3">
            Por el Equipo de trabajo.com.py · Actualizado el{' '}
            <time dateTime={entry.updated}>{formatUpdated(entry.updated)}</time>
          </p>
          <div className="mt-4 text-lg text-ink-secondary leading-relaxed">{lede}</div>

          {hero && <div className="mt-6">{hero}</div>}

          {toc.length > 0 && (
            <nav aria-label="En esta página" className="mt-8 rounded-[10px] border border-border bg-surface-2 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">En esta página</p>
              <ol className="mt-2 space-y-1.5 text-sm list-decimal pl-5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-ink hover:text-brand hover:underline">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="prose-guide mt-4">
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

          {sources && (
            <div className="mt-8 rounded-[10px] border border-border bg-surface px-5 py-4 text-sm text-ink-secondary">
              {sources}
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mt-10" aria-labelledby="segui-leyendo">
            <h2 id="segui-leyendo" className="text-lg font-bold text-ink mb-3">Seguí leyendo</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((key) => {
                const g = GUIDES[key];
                return (
                  <li key={key}>
                    <Link
                      href={g.href}
                      className="block h-full rounded-card border border-border bg-surface p-4 hover:border-brand transition-colors"
                    >
                      <span className="block font-semibold text-ink">{g.label}</span>
                      <span className="mt-1 block text-sm text-ink-secondary">{g.blurb}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <GuideCta variant={cta} />
      </div>
    </>
  );
}

function GuideCta({ variant }: { variant: 'postulantes' | 'empresas' | 'ambos' }) {
  const seeker = (
    <div className="rounded-card bg-ink text-white p-6">
      <p className="text-lg font-bold">¿Buscás trabajo?</p>
      <p className="mt-1 text-white/75 text-sm">
        Mirá las ofertas de trabajo publicadas hoy en Paraguay y postulate gratis, directo por WhatsApp.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/empleos" className="inline-flex items-center min-h-11 px-5 rounded-[12px] bg-brand font-semibold hover:bg-brand-hover">
          Ver empleos
        </Link>
        <Link href="/trabajo-sin-experiencia" className="inline-flex items-center min-h-11 px-5 rounded-[12px] border border-white/30 font-semibold hover:bg-white/10">
          Empleos sin experiencia
        </Link>
      </div>
    </div>
  );
  const employer = (
    <div className="rounded-card border border-border bg-gold-tint p-6">
      <p className="text-lg font-bold text-ink">¿Necesitás contratar personal?</p>
      <p className="mt-1 text-ink-secondary text-sm">
        Publicá tu oferta de empleo en trabajo.com.py: nuestro equipo la revisa y los postulantes te escriben directo a tu WhatsApp.
      </p>
      <Link href="/publicar" className="mt-4 inline-flex items-center min-h-11 px-5 rounded-[12px] bg-ink text-white font-semibold hover:bg-ink/90">
        Publicar un empleo
      </Link>
    </div>
  );

  return (
    <div className="mt-10 grid grid-cols-1 gap-4">
      {variant !== 'empresas' && seeker}
      {variant !== 'postulantes' && employer}
    </div>
  );
}
