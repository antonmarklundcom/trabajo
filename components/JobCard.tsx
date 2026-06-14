import Link from 'next/link';
import type { Job } from '@/lib/types';
import { formatSalary, formatRelativeDate, contractTypeLabel, seniorityLabel, modalityLabel } from '@/lib/formatters';

type Props = { job: Job };

export default function JobCard({ job }: Props) {
  const featured = job.featuredUntil && new Date(job.featuredUntil) > new Date();

  return (
    <article
      className={`bg-white border rounded-[10px] hover:shadow-sm transition-shadow ${
        featured
          ? 'border-[#F59E0B] border-l-4 border-l-[#F59E0B]'
          : 'border-[#E5E7EB]'
      }`}
    >
      <Link href={`/empleos/${job.slug}`} className="block p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] overflow-hidden border border-[#E5E7EB] bg-[#F7F8FA]">
            <img
              src={job.companyLogo ?? '/logos/default.svg'}
              alt={`Logo de ${job.company}`}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-[#16181D] leading-snug line-clamp-2">
                {job.title}
              </h2>
              {featured && (
                <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FDF4E3] text-[#92600A] whitespace-nowrap">
                  Destacado
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-[#5B6472] truncate">{job.company}</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5B6472]">
              <span className="flex items-center gap-1">
                <LocationIcon />
                {job.citySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon />
                {contractTypeLabel(job.contractType)}
              </span>
              <span className="flex items-center gap-1">
                <ModalityIcon />
                {modalityLabel(job.modality)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold text-[#16181D]">
                {job.salaryHidden ? 'A convenir' : formatSalary(job.salaryMin, job.salaryMax)}
              </span>
              <span className="text-xs text-[#5B6472]">
                {formatRelativeDate(job.postedAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

function LocationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}

function ModalityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
}
