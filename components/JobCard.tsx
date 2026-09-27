import Link from 'next/link';
import type { Job } from '@/lib/types';
import { formatSalary, relativeAgo, isPostedWithin, contractTypeLabel, modalityLabel } from '@/lib/formatters';
import { cityLabel } from '@/lib/labels';
import CompanyAvatar from './CompanyAvatar';

// One listing in every list on the site (home, /empleos, the taxonomy
// landings, similar jobs, blog related jobs).
//
// Built for scanning on a phone, which is where the site is read: the old card
// spent ~190px on three bordered chips and a divider, so a 390px screen showed
// two and a half jobs. This one is a dense row — title, company, salary + age,
// city · terms — and fits about four. The facts a seeker filters on in their
// head (where, how much, what kind) are all still here; they are text, not
// pills, because pills are for things you can tap and these are not.
//
// The title is an h3: every list it appears in sits under a section h2 (or an
// sr-only one on /empleos), so the outline stays h1 → h2 → h3.

type Props = { job: Job };

/** Listings younger than this carry a "Nuevo" tag — freshness is the seeker's signal. */
const NEW_FOR_DAYS = 3;

export default function JobCard({ job }: Props) {
  const featured = !!job.featuredUntil && new Date(job.featuredUntil) > new Date();
  const isNew = isPostedWithin(job.postedAt, NEW_FOR_DAYS);
  const salary = job.salaryHidden ? null : formatSalary(job.salaryMin, job.salaryMax);

  return (
    <article
      className={`group relative rounded-card border transition-[box-shadow,border-color] hover:shadow-[0_4px_14px_-4px_rgba(30,27,23,.16)] ${
        featured ? 'border-[#EDDCB4] bg-[#FDF8EC]' : 'border-border bg-surface hover:border-border-strong'
      }`}
    >
      <Link href={`/empleos/${job.slug}`} className="flex items-start gap-3.5 p-4 sm:p-5 min-h-11">
        <CompanyAvatar company={job.company} logo={job.companyLogo} size={44} />

        <div className="flex-1 min-w-0">
          {(featured || isNew) && (
            <div className="mb-1 flex items-center gap-1.5">
              {featured && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold text-white">
                  <StarIcon />
                  Destacado
                </span>
              )}
              {isNew && (
                <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-tint text-success">
                  Nuevo
                </span>
              )}
            </div>
          )}

          <h3 className="text-base sm:text-[17px] font-bold text-ink leading-snug line-clamp-2 break-words group-hover:text-brand transition-colors">
            {job.title}
          </h3>
          <p className="mt-0.5 text-sm text-ink-secondary truncate">{job.company}</p>

          {/* The salary never truncates — it is the number the seeker is
              scanning for. When a long range and the age don't fit on one
              line, the age wraps under it instead. */}
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-[15px] font-bold text-ink tabular-nums whitespace-nowrap">
              {salary ?? <span className="font-semibold text-ink-secondary">Salario a convenir</span>}
            </p>
            <time dateTime={job.postedAt} className="ml-auto text-xs text-ink-3 whitespace-nowrap">
              {capitalize(relativeAgo(job.postedAt))}
            </time>
          </div>

          <p className="mt-1 flex items-center gap-1 text-[13px] text-ink-secondary min-w-0">
            <PinIcon />
            <span className="truncate">
              {cityLabel(job.citySlug)}
              <span aria-hidden="true" className="mx-1.5 text-ink-3">·</span>
              {contractTypeLabel(job.contractType)}
              <span aria-hidden="true" className="mx-1.5 text-ink-3">·</span>
              {modalityLabel(job.modality)}
            </span>
          </p>
        </div>

        <ChevronIcon />
      </Link>
    </article>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-shrink-0 text-ink-3">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.34 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="hidden sm:block flex-shrink-0 self-center text-ink-3 group-hover:text-brand group-hover:translate-x-0.5 transition-transform"
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}
