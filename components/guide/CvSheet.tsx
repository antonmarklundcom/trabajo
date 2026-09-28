// An example CV drawn as a sheet of paper, in real HTML text so the example
// itself is readable content (and copyable), not a picture of one.
import type { CvExample } from '@/lib/cv-examples';

export default function CvSheet({ cv }: { cv: CvExample }) {
  return (
    <figure id={cv.id} className="not-prose my-6 scroll-mt-20">
      <figcaption className="mb-2 text-sm font-semibold text-ink-secondary">{cv.caption}</figcaption>
      <div className="rounded-[6px] border border-border bg-white p-5 sm:p-7 shadow-card text-[13px] leading-relaxed text-ink">
        <p className="text-xl font-bold leading-tight">{cv.name}</p>
        <p className="text-brand font-medium">{cv.headline}</p>
        <p className="mt-1 text-xs text-ink-secondary">{cv.contact}</p>
        {cv.sections.map((section) => (
          <div key={section.title} className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand border-b border-border pb-0.5">
              {section.title}
            </p>
            {section.text && <p className="mt-1.5 text-ink-secondary">{section.text}</p>}
            {section.entries?.map((entry) => (
              <div key={entry.left} className="mt-1.5">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold">{entry.left}</span>
                  {entry.right && <span className="text-ink-secondary">{entry.right}</span>}
                </div>
                {entry.bullets && (
                  <ul className="mt-0.5 list-disc pl-5 text-ink-secondary">
                    {entry.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}
