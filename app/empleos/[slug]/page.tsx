import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllPublishedJobSummaries,
  getCategory,
  getCity,
  getClosedJob,
  getJob,
  getJobs,
} from '@/lib/data';
import { canonicalFor } from '@/lib/seo';
import { formatSalary, formatRelativeDate, contractTypeLabel, seniorityLabel, modalityLabel, employmentTypeJsonLd } from '@/lib/formatters';
import WhatsAppButton from '@/components/WhatsAppButton';
import ShareLinks from '@/components/ShareLinks';
import LeadForm from '@/components/LeadForm';
import MarkdownContent, { parseMarkdown } from '@/components/MarkdownContent';
import CompanyAvatar from '@/components/CompanyAvatar';
import ApplySection from '@/components/postulante/ApplySection';
import SaveJobSection from '@/components/postulante/SaveJobSection';
import { candidateAccountsEnabled } from '@/lib/flags';
import JobCard from '@/components/JobCard';
import type { ClosedJob, Job } from '@/lib/types';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

/**
 * Every approved listing, prerendered at build.
 *
 * This used to be `getJobs({})` — the FIRST PAGE, twenty jobs — so listing 21
 * onwards was rendered on demand on its first visit, which for a crawler is
 * the visit that matters. The walk is the sitemap's, shared through
 * lib/data.ts.
 *
 * Bounded by the catalogue's size, and the build already runs with one worker
 * (PR #82), so the cost is one query per 20 listings plus a render each. If
 * the catalogue grows to where that stops being cheap, the fix is to slice
 * this to the most recent N and let the rest stay on-demand — `dynamicParams`
 * is on, so nothing 404s either way.
 */
export async function generateStaticParams() {
  const jobs = await getAllPublishedJobSummaries();
  return jobs.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) {
    // The tombstone is a real page with a 200, so it needs real metadata —
    // `noindex, follow` so Google drops it from the index but still walks the
    // links out of it, which is the whole reason the URL is not a 404 (§7 D6).
    const closed = await getClosedJob(slug);
    if (closed) {
      return {
        title: `${closed.title} — ${closed.company} (oferta cerrada)`,
        description: `Esta oferta de ${closed.title} en ${closed.company} ya no está disponible. Mirá otros empleos en trabajo.com.py.`,
        robots: { index: false, follow: true },
        // A tombstone is still one URL, and still the canonical address of the
        // listing that used to live at it. `noindex` decides whether Google
        // keeps it; the canonical decides which address it is.
        alternates: { canonical: canonicalFor(`/empleos/${slug}`) },
      };
    }
    return { title: 'Empleo no encontrado' };
  }

  return {
    title: `${job.title} — ${job.company}`,
    description: `${job.title} en ${job.company}. ${job.salaryHidden ? 'Salario a convenir.' : formatSalary(job.salaryMin, job.salaryMax) + '.'} Aplicá ahora en trabajo.com.py`,
    alternates: { canonical: canonicalFor(`/empleos/${job.slug}`) },
    openGraph: {
      title: `${job.title} — ${job.company}`,
      description: `${job.title} en ${job.company}`,
      type: 'website',
    },
  };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) {
    const closed = await getClosedJob(slug);
    if (closed) return <ClosedJobPage slug={slug} closed={closed} />;
    notFound();
  }

  const [category, city] = await Promise.all([
    getCategory(job.categorySlug),
    getCity(job.citySlug),
  ]);

  // U3 — "empleos similares". Read through lib/data.ts like every other job
  // read on this page, so it follows DATA_SOURCE and the visibility predicate
  // rather than reimplementing either.
  //
  // Category first, city as the FALLBACK rather than as a second filter: an
  // AND of both is empty for most postings outside Asunción, and an empty
  // block is what this is trying not to be. Nothing here reads candidate or
  // application data — it is the same public catalogue the page above it is.
  const similarJobs = await findSimilarJobs(job);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  const jobUrl = `${siteUrl}/empleos/${job.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    // The same HTML the visitor reads, produced by the same function the page
    // body uses (components/MarkdownContent.tsx). Google accepts HTML here and
    // the previous version — strip the asterisks, ship the raw text — lost the
    // list and heading structure of every description.
    //
    // parseMarkdown() escapes raw HTML BEFORE it applies any transform, so what
    // goes into the JSON-LD contains only the tags that function generates.
    // Deliberately NOT lib/blog.ts's renderMarkdown(): the two implementations
    // are separate on purpose (MarkdownContent.tsx's header states why), and a
    // job description is employer-submitted text.
    description: parseMarkdown(job.description),
    datePosted: job.postedAt.split('T')[0],
    // `expiresAt`, NOT `featuredUntil`. The old line told Google that a
    // listing's validity ended when its paid promotion did — wrong on every
    // unfeatured listing, and a Search Console error on every featured one
    // whose window closed before the job did. Omitted when there is no expiry:
    // Google accepts a missing validThrough; it does not accept a wrong one.
    ...(job.expiresAt ? { validThrough: job.expiresAt } : {}),
    // The page carries both the application form and the WhatsApp button, so
    // an applicant never leaves the site to apply.
    directApply: true,
    identifier: {
      '@type': 'PropertyValue',
      name: 'trabajo.com.py',
      value: job.slug,
    },
    employmentType: employmentTypeJsonLd(job.contractType),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(job.companyLogo ? { logo: `${siteUrl}${job.companyLogo}` } : {}),
      ...(job.companyWebsite ? { sameAs: job.companyWebsite } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city?.name ?? job.citySlug,
        addressCountry: 'PY',
      },
    },
    ...(job.modality === 'remoto'
      ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'Paraguay' } }
      : {}),
    ...(!job.salaryHidden && (job.salaryMin || job.salaryMax)
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'PYG',
            value: {
              '@type': 'QuantitativeValue',
              ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
              ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
              unitText: 'MONTH',
            },
          },
        }
      : {}),
    url: jobUrl,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Empleos', item: `${siteUrl}/empleos` },
      ...(category
        ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `${siteUrl}/trabajo/${category.slug}` }]
        : []),
      {
        '@type': 'ListItem',
        position: category ? 4 : 3,
        name: job.title,
        item: jobUrl,
      },
    ],
  };

  const chips = [
    contractTypeLabel(job.contractType),
    seniorityLabel(job.seniority),
    modalityLabel(job.modality),
  ];

  return (
    <>
      {/* JSON-LD — only on the detail page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6 flex-wrap" aria-label="Ruta">
          <Link href="/" className="hover:text-brand transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link href="/empleos" className="hover:text-brand transition-colors">Empleos</Link>
          {category && (
            <>
              <span aria-hidden="true">›</span>
              <Link href={`/trabajo/${category.slug}`} className="hover:text-brand transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium truncate max-w-xs">{job.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <article className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
              {job.featuredUntil && new Date(job.featuredUntil) > new Date() && (
                <span className="inline-flex items-center gap-1.5 mb-4 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-gold text-white">
                  ★ Empleo destacado
                </span>
              )}
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <CompanyAvatar company={job.company} logo={job.companyLogo} size={64} />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-lg text-ink-secondary">{job.company}</p>
                </div>
              </div>

              {/* Job images (PLAN-IMAGES.md §5) */}
              {job.images.length > 0 && (
                <div className={`grid gap-2 mb-6 ${job.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {job.images.map((url, index) => (
                    // eslint-disable-next-line @next/next/no-img-element -- one stored size, no next/image loader (PLAN-IMAGES.md §6)
                    <img
                      key={url}
                      src={url}
                      alt={`Foto ${index + 1} de ${job.images.length} del puesto ${job.title}`}
                      className="w-full aspect-video object-cover rounded-[10px] border border-border"
                    />
                  ))}
                </div>
              )}

              {/* Key details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-t border-b border-border mb-6">
                <Detail label="Ciudad" value={city?.name ?? job.citySlug} icon={<LocationIcon />} />
                <Detail
                  label="Salario"
                  value={job.salaryHidden ? 'A convenir' : formatSalary(job.salaryMin, job.salaryMax)}
                  icon={<SalaryIcon />}
                />
                <Detail label="Contrato" value={contractTypeLabel(job.contractType)} icon={<ContractIcon />} />
                <Detail label="Modalidad" value={modalityLabel(job.modality)} icon={<ModalityIcon />} />
              </div>

              {/* Chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-surface-2 text-ink-secondary border border-border"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              {/* Description */}
              <div className="prose-job">
                <MarkdownContent content={job.description} />
              </div>

              {/* Meta */}
              <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row gap-4 text-sm text-ink-secondary">
                <span>Publicado: {formatRelativeDate(job.postedAt)}</span>
                {job.updatedAt !== job.postedAt && (
                  <span>Actualizado: {formatRelativeDate(job.updatedAt)}</span>
                )}
              </div>
            </article>

            <ShareLinks
              title={`${job.title} — ${job.company}`}
              url={jobUrl}
              className="mt-6"
            />

            {/* Omitted entirely when empty — an "Empleos similares" heading
                over nothing reads as a broken page. */}
            {similarJobs.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-bold text-ink mb-4">Empleos similares</h2>
                <div className="flex flex-col gap-4">
                  {similarJobs.map((similar) => (
                    <JobCard key={similar.slug} job={similar} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Apply */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-[10px] border border-border p-6 sticky top-24">
              <h2 className="text-lg font-bold text-ink mb-4">Postulate ahora</h2>

              {candidateAccountsEnabled() && (
                <>
                  <ApplySection jobSlug={job.slug} companyName={job.company} />
                  <SaveJobSection jobSlug={job.slug} />
                </>
              )}

              {job.whatsapp && (
                <div className="mb-6">
                  <WhatsAppButton
                    whatsapp={job.whatsapp}
                    jobTitle={job.title}
                    jobSlug={job.slug}
                    citySlug={job.citySlug}
                    categorySlug={job.categorySlug}
                    contractType={job.contractType}
                  />
                  <p className="mt-2 text-xs text-ink-secondary text-center">
                    Te conecta directamente con la empresa
                  </p>
                </div>
              )}

              {job.whatsapp && (
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-ink-secondary">o también</span>
                  </div>
                </div>
              )}

              <LeadForm
                jobSlug={job.slug}
                jobTitle={job.title}
                citySlug={job.citySlug}
                categorySlug={job.categorySlug}
                contractType={job.contractType}
              />
            </div>

            {/* Category / similar jobs link */}
            {category && (
              <div className="mt-4 bg-white rounded-[10px] border border-border p-4">
                <p className="text-sm text-ink-secondary">
                  Más empleos en{' '}
                  <Link href={`/trabajo/${category.slug}`} className="text-brand font-medium hover:underline">
                    {category.name}
                  </Link>
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Prose styles for job descriptions */}
      <style>{`
        .prose-job p { margin-bottom: 0.75rem; color: #44403A; line-height: 1.7; }
        .prose-job h2 { font-size: 1.1rem; font-weight: 700; color: #1E1B17; margin: 1.25rem 0 0.5rem; }
        .prose-job h3 { font-size: 1rem; font-weight: 600; color: #1E1B17; margin: 1rem 0 0.375rem; }
        .prose-job ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .prose-job li { margin-bottom: 0.25rem; color: #44403A; line-height: 1.6; }
        .prose-job strong { color: #1E1B17; font-weight: 600; }
      `}</style>
    </>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-ink-secondary uppercase tracking-wide font-medium">
        <span className="text-ink-secondary">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function LocationIcon() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>;
}
function SalaryIcon() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>;
}
function ContractIcon() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>;
}
function ModalityIcon() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>;
}

/**
 * What an expired or archived listing's URL serves instead of a 404
 * (PLAN-GROWTH.md §4 S3, §7 D6).
 *
 * HTTP 200 with `noindex, follow` (set in generateMetadata above), so Google
 * drops the page from the index but still walks the links out of it, and the
 * visitor who arrived from a bookmark or a shared link lands somewhere useful
 * instead of on a dead end. That is the trade: the URL keeps its inbound
 * links, and stops competing for a query it can no longer answer.
 *
 * Deliberately absent, all four for the same reason — the listing is closed
 * and nothing here may suggest otherwise: no description, no apply form, no
 * WhatsApp button, and NO JobPosting JSON-LD. Structured data announcing a job
 * that cannot be applied to is the exact error the validThrough fix above
 * exists to stop making.
 */
async function ClosedJobPage({ slug, closed }: { slug: string; closed: ClosedJob }) {
  const [category, city, similar] = await Promise.all([
    getCategory(closed.categorySlug),
    getCity(closed.citySlug),
    findSimilarJobs({ slug, categorySlug: closed.categorySlug, citySlug: closed.citySlug }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6 flex-wrap" aria-label="Ruta">
        <Link href="/" className="hover:text-brand transition-colors">Inicio</Link>
        <span aria-hidden="true">›</span>
        <Link href="/empleos" className="hover:text-brand transition-colors">Empleos</Link>
        {category && (
          <>
            <span aria-hidden="true">›</span>
            <Link href={`/trabajo/${category.slug}`} className="hover:text-brand transition-colors">
              {category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Esta oferta ya no está disponible</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          El aviso <span className="font-medium text-ink">{closed.title}</span> de{' '}
          <span className="font-medium text-ink">{closed.company}</span> ya cerró
          {closed.closedAt ? ` el ${formatClosedDate(closed.closedAt)}` : ''}. Abajo te dejamos
          otros empleos parecidos que sí están abiertos.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {category && (
            <Link
              href={`/trabajo/${category.slug}`}
              className="px-5 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm text-center transition-colors"
            >
              Ver empleos de {category.name}
            </Link>
          )}
          <Link
            href={city ? `/empleos?ciudad=${city.slug}` : '/empleos'}
            className="px-5 py-2.5 rounded-[10px] border border-border text-ink-secondary font-medium text-sm text-center hover:border-brand hover:text-brand transition-colors"
          >
            {city ? `Ver empleos en ${city.name}` : 'Ver todos los empleos'}
          </Link>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-ink mb-4">Empleos similares</h2>
          <div className="flex flex-col gap-4">
            {similar.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatClosedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const SIMILAR_JOBS_LIMIT = 5;

/**
 * Up to five other published jobs to show under this one.
 *
 * `getJobs` has no limit parameter — it returns a page — so the current job is
 * filtered out of the page BEFORE the slice. Slicing first would have shown
 * four whenever this job was among the five most recent in its own category,
 * which is exactly when a new posting is being read.
 *
 * The city query only runs when the category produced nothing, so the common
 * case is one read, and both go through the cached seam.
 */
async function findSimilarJobs(
  job: Pick<Job, 'slug' | 'categorySlug' | 'citySlug'>,
): Promise<Job[]> {
  const byCategory = await getJobs({ categoria: job.categorySlug, orden: 'recientes' });
  const fromCategory = byCategory.jobs.filter((j) => j.slug !== job.slug);
  if (fromCategory.length > 0) return fromCategory.slice(0, SIMILAR_JOBS_LIMIT);

  const byCity = await getJobs({ ciudad: job.citySlug, orden: 'recientes' });
  return byCity.jobs.filter((j) => j.slug !== job.slug).slice(0, SIMILAR_JOBS_LIMIT);
}
