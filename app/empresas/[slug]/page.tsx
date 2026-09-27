import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllPublishedJobSummaries, getCompany, getCompanyJobs } from '@/lib/data';
import { canonicalFor, companiesWithPublicJobs, companyRobots, siteUrl } from '@/lib/seo';
import CompanyAvatar from '@/components/CompanyAvatar';
import JobCard from '@/components/JobCard';
import JsonLd from '@/components/JsonLd';
import EmployerBand from '@/components/EmployerBand';

// Public company pages (PLAN-GROWTH.md §4 D5, §7 D11).
//
// Every read goes through lib/data.ts: getCompany() for the profile (public
// fields only — no WhatsApp, email or phone of the company, by construction of
// the Company type) and getCompanyJobs() for the list, which is getJobs() with
// the `empresa` filter and therefore the same visibility predicate as every
// other public list.

// Same as the job page: cached reads are invalidated on demand by every admin
// and employer mutation (lib/cache.ts lists this route), so the timer is only
// the safety net for job expiry and featured_until lapsing.
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

/**
 * Every company with a public job, prerendered at build — the same set the
 * sitemap lists, from the same walk. A company whose jobs all expired is
 * rendered on demand (`dynamicParams` is on), as a noindex page.
 */
export async function generateStaticParams() {
  const jobs = await getAllPublishedJobSummaries();
  return [...companiesWithPublicJobs(jobs).keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return { title: 'Empresa no encontrada', robots: { index: false, follow: true } };

  const title = `Empleos en ${company.name}`;
  const description =
    company.jobCount > 0
      ? `${company.jobCount === 1 ? 'Un empleo publicado' : `${company.jobCount} empleos publicados`} por ${company.name} en trabajo.com.py. Postulate gratis y te contactás directo con la empresa.`
      : `${company.name} no tiene empleos publicados en este momento. Mirá otras ofertas de trabajo en Paraguay en trabajo.com.py.`;

  return {
    title,
    description,
    // Indexable only while there is something to apply to — the rule lives in
    // lib/seo.ts and `npm run seo:verify` evaluates it.
    robots: companyRobots(company.jobCount),
    alternates: { canonical: canonicalFor(`/empresas/${company.slug}`) },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  const jobs = await getCompanyJobs(company.slug);

  const base = siteUrl();
  const pageUrl = `${base}/empresas/${company.slug}`;
  // A disk-driver logo is site-relative (/img/...), a bucket logo is already
  // absolute. JSON-LD needs absolute either way.
  const logoUrl = company.logo
    ? company.logo.startsWith('/')
      ? `${base}${company.logo}`
      : company.logo
    : null;
  const paragraphs = (company.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: pageUrl,
    ...(logoUrl ? { logo: logoUrl } : {}),
    ...(paragraphs.length > 0 ? { description: paragraphs.join('\n\n') } : {}),
    // getCompany() already dropped any website isHttpUrl rejects.
    ...(company.website ? { sameAs: company.website } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: base },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${base}/empleos` },
      { '@type': 'ListItem', position: 3, name: company.name, item: pageUrl },
    ],
  };

  const countLabel =
    company.jobCount === 0
      ? 'Sin empleos publicados por ahora'
      : company.jobCount === 1
        ? '1 empleo publicado'
        : `${company.jobCount} empleos publicados`;

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10 sm:py-8">
        <nav aria-label="Ruta" className="mb-4 sm:mb-6 text-sm text-ink-secondary">
          <Link
            href="/empleos"
            className="sm:hidden inline-flex items-center gap-1 min-h-11 -my-2 font-medium hover:text-brand"
          >
            <span aria-hidden="true">‹</span>
            Todos los empleos
          </Link>
          <ol className="hidden sm:flex items-center gap-2 flex-wrap">
            <li><Link href="/" className="hover:text-brand transition-colors">Inicio</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/empleos" className="hover:text-brand transition-colors">Empleos</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-ink font-medium truncate max-w-xs" aria-current="page">{company.name}</li>
          </ol>
        </nav>

        <header className="bg-surface rounded-card border border-border shadow-card p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <CompanyAvatar company={company.name} logo={company.logo} size={64} />
            <div className="flex-1 min-w-0">
              <h1 className="text-[1.625rem] sm:text-3xl font-bold text-ink leading-[1.15] tracking-tight text-balance break-words">
                {company.name}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-ink-secondary">{countLabel}</p>
            </div>
          </div>

          {/* Plain text, escaped by React — the description is employer-typed
              in a plain textarea and is never interpreted as Markdown or HTML. */}
          {paragraphs.length > 0 && (
            <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-secondary">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line break-words">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* nofollow: the address is employer-typed, and a link from every
              company page is not an endorsement the site gives. */}
          {company.website && (
            <p className="mt-5">
              <a
                href={company.website}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-11 -my-2 text-sm font-medium text-brand hover:underline break-all"
              >
                <GlobeIcon />
                {displayHost(company.website)}
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </p>
          )}
        </header>

        <section className="mt-8" aria-labelledby="empleos-empresa">
          <h2 id="empleos-empresa" className="text-lg font-bold text-ink mb-4">
            Empleos publicados ({jobs.length})
          </h2>
          {jobs.length === 0 ? (
            <div className="bg-surface rounded-card border border-border shadow-card p-6 sm:p-8 text-center">
              <p className="text-ink font-semibold">
                {company.name} no tiene empleos publicados en este momento.
              </p>
              <p className="mt-2 text-sm text-ink-secondary">
                Volvé a mirar más adelante o buscá entre las demás ofertas del sitio.
              </p>
              <Link
                href="/empleos"
                className="mt-5 inline-flex items-center justify-center min-h-11 px-5 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold"
              >
                Ver todos los empleos
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          )}
        </section>

        <EmployerBand />
      </div>
    </>
  );
}

/** "https://www.empresa.com.py/es/" → "empresa.com.py/es" — readable, not the raw href. */
function displayHost(website: string): string {
  try {
    const url = new URL(website);
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return website;
  }
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-shrink-0">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
        clipRule="evenodd"
      />
    </svg>
  );
}
