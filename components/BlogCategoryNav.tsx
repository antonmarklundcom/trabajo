// The category pills on /blog and on every archive (PLAN-GROWTH.md §4 C2):
// links, not labels, so the archives are one hop from the hub and from each
// other. Only categories with a published post get a pill — a link to an
// archive that renders noindex would be a crawl path to a page that asks not
// to be indexed. The archive being viewed always gets one, so the reader can
// see where they are even on an archive that has just emptied.
import Link from 'next/link';
import { BLOG_CATEGORY_LABELS, blogCategoryPath, type BlogCategory } from '@/lib/blog-categories';

type Props = {
  counts: ReadonlyArray<{ category: BlogCategory; total: number }>;
  active?: BlogCategory;
};

export default function BlogCategoryNav({ counts, active }: Props) {
  const visible = counts.filter((row) => row.total > 0 || row.category === active);
  if (visible.length === 0) return null;

  return (
    <nav aria-label="Categorías del blog" className="mt-6">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Pill href="/blog" current={!active}>
            Todos
          </Pill>
        </li>
        {visible.map((row) => (
          <li key={row.category}>
            <Pill href={blogCategoryPath(row.category)} current={row.category === active}>
              {BLOG_CATEGORY_LABELS[row.category]}
              {row.total > 0 && <span className="ml-1.5 text-xs text-ink-3">{row.total}</span>}
            </Pill>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Pill({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={
        current
          ? 'inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full text-sm font-medium border border-brand bg-brand-tint text-brand'
          : 'inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full text-sm border border-border bg-white text-ink-secondary hover:border-brand hover:text-brand transition-colors'
      }
    >
      {children}
    </Link>
  );
}
