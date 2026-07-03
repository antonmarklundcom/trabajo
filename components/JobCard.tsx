import Link from 'next/link';
import type { Job } from '@/lib/types';
import { formatSalary, formatRelativeDate, contractTypeLabel, modalityLabel } from '@/lib/formatters';
import { cityLabel } from '@/lib/labels';
import CompanyAvatar from './CompanyAvatar';

type Props = { job: Job };

export default function JobCard({ job }: Props) {
  const featured = !!job.featuredUntil && new Date(job.featuredUntil) > new Date();

  return (
    <article
      className={`relative rounded-[14px] border transition-shadow hover:shadow-[0_4px_12px_-2px_rgba(30,27,23,.12)] ${
        featured
          ? 'border-[#EDDCB4] bg-[#FDF8EC] shadow-[0_12px_30px_-16px_rgba(176,129,44,.4)]'
          : 'border-[#E7E1D6] bg-white'
      }`}
    >
      <Link href={`/empleos/${job.slug}`} className="block p-5">
        {featured && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#B0812C] text-white">
            <StarIcon />
            Destacado
          </span>
        )}

        <div className="flex items-start gap-4">
          <CompanyAvatar company={job.company} logo={job.companyLogo} size={52} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold text-[#1E1B17] leading-snug line-clamp-2 break-words pr-16">
              {job.title}
            </h2>
            <p className="mt-0.5 text-sm text-[#57514A] truncate">{job.company}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip>{cityLabel(job.citySlug)}</Chip>
              <Chip>{contractTypeLabel(job.contractType)}</Chip>
              <Chip>{modalityLabel(job.modality)}</Chip>
            </div>

            <div className="mt-4 pt-3 border-t border-[#EFE9DF] flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-bold text-[#1E1B17]">
                {job.salaryHidden ? (
                  <span className="italic font-semibold text-[#57514A]">A convenir</span>
                ) : (
                  formatSalary(job.salaryMin, job.salaryMax)
                )}
              </span>
              <span className="text-xs text-[#8A8378]">
                {formatRelativeDate(job.postedAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F1EA] text-[#57514A] border border-[#E7E1D6]">
      {children}
    </span>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.34 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}
