import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllPublishedJobSummaries,
  getCategory,
  getCity,
  getClosedJob,
  getCompany,
  getJob,
  getJobs,
} from '@/lib/data';
import { canonicalFor } from '@/lib/seo';
import { formatSalary, formatRelativeDate, relativeAgo, contractTypeLabel, seniorityLabel, modalityLabel, employmentTypeJsonLd } from '@/lib/formatters';
import WhatsAppButton from '@/components/WhatsAppButton';
import ShareLinks from '@/components/ShareLinks';
import LeadForm from '@/components/LeadForm';
import MarkdownContent, { parseMarkdown } from '@/components/MarkdownContent';
import CompanyAvatar from '@/components/CompanyAvatar';
import ApplySection from '@/components/postulante/ApplySection';
import SaveJobSection from '@/components/postulante/SaveJobSection';
import { candidateAccountsEnabled } from '@/lib/flags';
import JobCard from '@/components/JobCard';
import JobViewBeacon from '@/components/JobViewBeacon';
import type { ClosedJob, Job } from '@/lib/types';
import MobileApplyBar from '@/components/MobileApplyBar';
import { reportListingHref } from '@/lib/whatsapp';
import JsonLd from '@/components/JsonLd';
import { isHttpUrl } from '@/lib/company-website';
import EmployerBand from '@/components/EmployerBand';
import BlogPostLinks from '@/components/BlogPostLinks';
import { getPostsForJobCategory } from '@/lib/blog';

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
    return { title: 'Empleo no encontrado', robots: { index: false, follow: true } };
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

  // getCompany() is one cached aggregate row; its jobCount decides whether
  // "Ver otros empleos de {company}" has anything to link to.
  const [category, city, company] = await Promise.all([
    getCategory(job.categorySlug),
    getCity(job.citySlug),
    getCompany(job.companySlug),
  ]);
  const hasOtherCompanyJobs = (company?.jobCount ?? 0) > 1;

  // U3 — "empleos similares". Read through lib/data.ts like every other job
  // read on this page, so it follows DATA_SOURCE and the visibility predicate
  // rather than reimplementing either.
  //
  // Category first, city as the FALLBACK rather than as a second filter: an
  // AND of both is empty for most postings outside Asunción, and an empty
  // block is what this is trying not to be. Nothing here reads candidate or
  // application data — it is the same public catalogue the page above it is.
  const [similarJobs, blogPosts] = await Promise.all([
    findSimilarJobs(job),
    getPostsForJobCategory(job.categorySlug, 2, 'consejos-cv'),
  ]);

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
      // Rows written before companyWebsiteSchema existed are not re-validated
      // in the DB, so the read checks too.
      ...(job.companyWebsite && isHttpUrl(job.companyWebsite) ? { sameAs: job.companyWebsite } : {}),
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

  const isFeatured = job.featuredUntil !== null && new Date(job.featuredUntil) > new Date();
  const salaryText = job.salaryHidden ? 'A convenir' : formatSalary(job.salaryMin, job.salaryMax);
  const postedLabel = formatRelativeDate(job.postedAt);
  // Only when it says something the "Publicado" line does not: two timestamps
  // seconds apart used to render the same relative date twice.
  const updatedAgo = relativeAgo(job.updatedAt);
  const showUpdated = updatedAgo !== relativeAgo(job.postedAt);
  const reportHref = reportListingHref(job.title, jobUrl);

  // Anchors shared by the top apply block, the form section and the sticky
  // bar (components/MobileApplyBar.tsx).
  const APPLY_TOP_ID = 'postular-arriba';
  const APPLY_FORM_ID = 'postular';

  const whatsappProps = job.whatsapp
    ? {
        whatsapp: job.whatsapp,
        jobTitle: job.title,
        jobSlug: job.slug,
        citySlug: job.citySlug,
        categorySlug: job.categorySlug,
        contractType: job.contractType,
      }
    : null;

  return (
    <>
      {/* Counts the view for the company's dashboard. Live listings only — the
          tombstone above returns before this. */}
      <JobViewBeacon slug={job.slug} />
      {/* JSON-LD — only on the detail page */}
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10 sm:py-8">
        {/* Breadcrumb. On a phone the full trail wraps to three lines above the
            title, so it collapses to one "back to the category" link there. */}
        <nav aria-label="Ruta" className="mb-4 sm:mb-6 text-sm text-ink-secondary">
          <Link
            href={category ? `/trabajo/${category.slug}` : '/empleos'}
            className="sm:hidden inline-flex items-center gap-1 min-h-11 -my-2 font-medium hover:text-brand"
          >
            <span aria-hidden="true">‹</span>
            {category ? category.name : 'Todos los empleos'}
          </Link>
          <ol className="hidden sm:flex items-center gap-2 flex-wrap">
            <li><Link href="/" className="hover:text-brand transition-colors">Inicio</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/empleos" className="hover:text-brand transition-colors">Empleos</Link></li>
            {category && (
              <>
                <li aria-hidden="true">›</li>
                <li>
                  <Link href={`/trabajo/${category.slug}`} className="hover:text-brand transition-colors">
                    {category.name}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">›</li>
            <li className="text-ink font-medium truncate max-w-xs" aria-current="page">{job.title}</li>
          </ol>
        </nav>

        {/* One column on a phone, in reading order: header → apply → description
            → form → more jobs. From `lg` the apply card moves into a sticky
            sidebar and the top apply block is dropped. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:items-start">
          <div className="min-w-0">
            <article className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
              {/* Header */}
              <header className="p-5 sm:p-8">
                {isFeatured && (
                  <span className="inline-flex items-center gap-1 mb-4 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gold-tint text-gold-strong border border-gold/30">
                    <span aria-hidden="true">★</span> Empleo destacado
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <CompanyAvatar company={job.company} logo={job.companyLogo} size={56} />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-[1.625rem] sm:text-3xl font-bold text-ink leading-[1.15] tracking-tight text-balance">
                      {job.title}
                    </h1>
                    <p className="mt-1.5 text-base sm:text-lg text-ink-secondary">
                      <Link
                        href={`/empresas/${job.companySlug}`}
                        className="underline decoration-border-strong underline-offset-4 hover:text-brand hover:decoration-brand"
                      >
                        {job.company}
                      </Link>
                    </p>
                  </div>
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-secondary">
                  <Link
                    href={`/trabajo-en/${job.citySlug}`}
                    className="inline-flex items-center gap-1 font-medium text-ink hover:text-brand"
                  >
                    <LocationIcon />
                    {city?.name ?? job.citySlug}
                  </Link>
                  <span aria-hidden="true" className="text-ink-3">·</span>
                  <time dateTime={job.postedAt}>{postedLabel}</time>
                </p>

                {/* Salary first and largest: it is the first thing a seeker
                    decides on, and "A convenir" deserves to be said plainly. */}
                <div className="mt-5 rounded-[12px] bg-surface-2 px-4 py-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Salario</p>
                  <p className="mt-0.5 text-xl font-bold text-ink tabular-nums">{salaryText}</p>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <Fact label="Contrato" value={contractTypeLabel(job.contractType)} />
                  <Fact label="Modalidad" value={modalityLabel(job.modality)} />
                  <Fact label="Experiencia" value={seniorityLabel(job.seniority)} />
                </dl>

                {/* The apply block, once, near the top — phones only. The
                    sticky bar takes over when this scrolls away. */}
                <div id={APPLY_TOP_ID} className="lg:hidden mt-6 space-y-2.5">
                  {whatsappProps ? (
                    <>
                      <WhatsAppButton {...whatsappProps} />
                      <a
                        href={`#${APPLY_FORM_ID}`}
                        className="flex items-center justify-center min-h-12 w-full rounded-[12px] border border-border-strong bg-surface text-ink font-semibold hover:bg-surface-2"
                      >
                        Postularme con el formulario
                      </a>
                    </>
                  ) : (
                    <a
                      href={`#${APPLY_FORM_ID}`}
                      className="flex items-center justify-center min-h-[52px] w-full rounded-[12px] bg-brand hover:bg-brand-hover text-white font-semibold"
                    >
                      Postularme a este empleo
                    </a>
                  )}
                  <p className="text-xs text-ink-secondary text-center">
                    Gratis · Te contactás directo con la empresa
                  </p>
                </div>
              </header>

              {/* Job images (PLAN-IMAGES.md §5) */}
              {job.images.length > 0 && (
                <div className={`px-5 sm:px-8 pb-2 grid gap-2 ${job.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {job.images.map((url, index) => (
                    // eslint-disable-next-line @next/next/no-img-element -- one stored size, no next/image loader (PLAN-IMAGES.md §6)
                    <img
                      key={url}
                      src={url}
                      alt={`Foto ${index + 1} de ${job.images.length} del puesto ${job.title}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-video object-cover rounded-[10px] border border-border"
                    />
                  ))}
                </div>
              )}

              {/* Description */}
              <section aria-labelledby="descripcion" className="border-t border-border p-5 sm:p-8">
                <h2 id="descripcion" className="text-lg font-bold text-ink mb-4">Descripción del puesto</h2>
                <div className="prose-job">
                  <MarkdownContent content={job.description} />
                </div>
                <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-3">
                  <time dateTime={job.postedAt}>{postedLabel}</time>
                  {showUpdated && (
                    <>
                      <span aria-hidden="true">·</span>
                      <time dateTime={job.updatedAt}>Actualizado {updatedAgo}</time>
                    </>
                  )}
                </p>
              </section>
            </article>

            {/* Trust note. Fraud is the reason seekers distrust job boards;
                saying the rule out loud, next to a one-tap report, is cheap
                and it is the promise the whole site makes. */}
            <aside
              aria-label="Seguridad"
              className="mt-4 flex gap-3 rounded-card border border-border bg-surface-2 p-4 text-sm text-ink-secondary"
            >
              <ShieldIcon />
              <p>
                <strong className="text-ink font-semibold">Postularte es gratis.</strong>{' '}
                Ninguna empresa seria te cobra por una entrevista, un curso o un uniforme.
                {reportHref && (
                  <>
                    {' '}
                    <a
                      href={reportHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand hover:underline"
                    >
                      Reportar este aviso
                    </a>
                  </>
                )}
              </p>
            </aside>
          </div>

          {/* Apply card: after the description on a phone (the top block and
              the sticky bar link here), a sticky sidebar from `lg`. */}
          <aside
            id={APPLY_FORM_ID}
            className="mt-6 lg:mt-0 lg:row-span-2 lg:sticky lg:top-24 scroll-mt-20"
            aria-labelledby="postular-titulo"
          >
            <div className="bg-surface rounded-card border border-border shadow-card p-5 sm:p-6">
              <h2 id="postular-titulo" className="text-lg font-bold text-ink">
                <span className="lg:hidden">Postulate con el formulario</span>
                <span className="hidden lg:inline">Postulate a este empleo</span>
              </h2>
              <p className="mt-1 mb-5 text-sm text-ink-secondary">
                <span className="lg:hidden">La empresa recibe tus datos y te contacta.</span>
                <span className="hidden lg:inline">Gratis · Te contactás directo con la empresa.</span>
              </p>

              {candidateAccountsEnabled() && (
                <>
                  <ApplySection jobSlug={job.slug} companyName={job.company} />
                  <SaveJobSection jobSlug={job.slug} />
                </>
              )}

              {/* On a phone WhatsApp is already at the top and in the sticky
                  bar; here it would be a third copy above the form. */}
              {whatsappProps && (
                <div className="hidden lg:block mb-6">
                  <WhatsAppButton {...whatsappProps} />
                  <div className="relative mt-6" aria-hidden="true">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-surface px-3 text-ink-secondary">o completá el formulario</span>
                    </div>
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
          </aside>

          <div className="min-w-0 mt-8 lg:mt-6">
            <ShareLinks title={`${job.title} — ${job.company}`} url={jobUrl} />

            {/* Omitted entirely when empty — an "Empleos similares" heading
                over nothing reads as a broken page. */}
            {similarJobs.length > 0 && (
              <section className="mt-10" aria-labelledby="similares">
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h2 id="similares" className="text-lg font-bold text-ink">Empleos similares</h2>
                  {category && (
                    <Link href={`/trabajo/${category.slug}`} className="text-sm font-medium text-brand hover:underline whitespace-nowrap">
                      Ver más <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  {similarJobs.map((similar) => (
                    <JobCard key={similar.slug} job={similar} />
                  ))}
                </div>
              </section>
            )}

            {hasOtherCompanyJobs && (
              <p className="mt-6 text-sm">
                <Link href={`/empresas/${job.companySlug}`} className="text-brand font-medium hover:underline">
                  Ver otros empleos de {job.company} <span aria-hidden="true">→</span>
                </Link>
              </p>
            )}

            {category && (
              <p className="mt-6 text-sm text-ink-secondary">
                Más empleos en{' '}
                <Link href={`/trabajo/${category.slug}`} className="text-brand font-medium hover:underline">
                  {category.name}
                </Link>
                {city && (
                  <>
                    {' '}en{' '}
                    <Link
                      href={`/trabajo/${category.slug}/${job.citySlug}`}
                      className="text-brand font-medium hover:underline"
                    >
                      {city.name}
                    </Link>
                  </>
                )}
              </p>
            )}

            {/* Blog (PLAN-GROWTH.md §4 C2): posts written for this job's
                category, topped up with the newest CV advice. Below the
                similar jobs rather than under the description so it never
                sits between a phone reader and the apply card. */}
            <BlogPostLinks title="Consejos para postularte" posts={blogPosts} className="mt-10" />

            <EmployerBand />
          </div>
        </div>
      </div>

      {/* Phones only; lives outside the grid so `fixed` is relative to the
          viewport, not to a transformed ancestor. */}
      <MobileApplyBar
        whatsapp={job.whatsapp}
        jobTitle={job.title}
        jobSlug={job.slug}
        citySlug={job.citySlug}
        categorySlug={job.categorySlug}
        contractType={job.contractType}
        topAnchorId={APPLY_TOP_ID}
        formAnchorId={APPLY_FORM_ID}
      />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-border px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink leading-snug">{value}</dd>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-shrink-0 text-success mt-px">
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM13.707 8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function LocationIcon() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>;
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
