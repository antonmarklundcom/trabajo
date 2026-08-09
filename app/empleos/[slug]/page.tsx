import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getJob, getJobs, getCategory, getCity } from '@/lib/data';
import { formatSalary, formatRelativeDate, contractTypeLabel, seniorityLabel, modalityLabel, employmentTypeJsonLd } from '@/lib/formatters';
import WhatsAppButton from '@/components/WhatsAppButton';
import LeadForm from '@/components/LeadForm';
import MarkdownContent from '@/components/MarkdownContent';
import CompanyAvatar from '@/components/CompanyAvatar';

// Cached reads are invalidated on demand by every admin mutation
// (lib/cache.ts), so this timer is only the safety net for job expiry and
// featured_until lapsing — both query predicates with no write to hook onto.
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const { jobs } = await getJobs({});
  return jobs.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return { title: 'Empleo no encontrado' };

  return {
    title: `${job.title} — ${job.company}`,
    description: `${job.title} en ${job.company}. ${job.salaryHidden ? 'Salario a convenir.' : formatSalary(job.salaryMin, job.salaryMax) + '.'} Aplicá ahora en trabajo.com.py`,
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
  if (!job) notFound();

  const [category, city] = await Promise.all([
    getCategory(job.categorySlug),
    getCity(job.citySlug),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'),
    datePosted: job.postedAt.split('T')[0],
    validThrough: job.featuredUntil ?? undefined,
    employmentType: employmentTypeJsonLd(job.contractType),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(job.companyLogo ? { logo: `${siteUrl}${job.companyLogo}` } : {}),
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
    url: `${siteUrl}/empleos/${job.slug}`,
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
        item: `${siteUrl}/empleos/${job.slug}`,
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
        <nav className="flex items-center gap-2 text-sm text-[#57514A] mb-6 flex-wrap" aria-label="Ruta">
          <Link href="/" className="hover:text-[#C0362A] transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link href="/empleos" className="hover:text-[#C0362A] transition-colors">Empleos</Link>
          {category && (
            <>
              <span aria-hidden="true">›</span>
              <Link href={`/trabajo/${category.slug}`} className="hover:text-[#C0362A] transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">›</span>
          <span className="text-[#1E1B17] font-medium truncate max-w-xs">{job.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <article className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
              {job.featuredUntil && new Date(job.featuredUntil) > new Date() && (
                <span className="inline-flex items-center gap-1.5 mb-4 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-[#B0812C] text-white">
                  ★ Empleo destacado
                </span>
              )}
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <CompanyAvatar company={job.company} logo={job.companyLogo} size={64} />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#1E1B17] leading-tight">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-lg text-[#57514A]">{job.company}</p>
                </div>
              </div>

              {/* Key details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-t border-b border-[#E7E1D6] mb-6">
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
                    className="px-3 py-1 rounded-full text-xs font-medium bg-[#F5F1EA] text-[#57514A] border border-[#E7E1D6]"
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
              <div className="mt-8 pt-6 border-t border-[#E7E1D6] flex flex-col sm:flex-row gap-4 text-sm text-[#57514A]">
                <span>Publicado: {formatRelativeDate(job.postedAt)}</span>
                {job.updatedAt !== job.postedAt && (
                  <span>Actualizado: {formatRelativeDate(job.updatedAt)}</span>
                )}
              </div>
            </article>
          </div>

          {/* Sidebar: Apply */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sticky top-24">
              <h2 className="text-lg font-bold text-[#1E1B17] mb-4">Postulate ahora</h2>

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
                  <p className="mt-2 text-xs text-[#57514A] text-center">
                    Te conecta directamente con la empresa
                  </p>
                </div>
              )}

              {job.whatsapp && (
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E7E1D6]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-[#57514A]">o también</span>
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
              <div className="mt-4 bg-white rounded-[10px] border border-[#E7E1D6] p-4">
                <p className="text-sm text-[#57514A]">
                  Más empleos en{' '}
                  <Link href={`/trabajo/${category.slug}`} className="text-[#C0362A] font-medium hover:underline">
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
      <span className="flex items-center gap-1.5 text-xs text-[#57514A] uppercase tracking-wide font-medium">
        <span className="text-[#57514A]">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold text-[#1E1B17]">{value}</span>
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
