// Numbered pagination for /empleos (PLAN-NEXT.md §3 U2).
//
// It replaced an Anterior/Siguiente pair, which had two problems. A visitor on
// page 1 of 40 could only walk, and a crawler could only walk too — page 12 was
// twelve requests deep, which is how a catalogue's tail ends up unindexed.
//
// Plain <a>, not <Link>: these are ordinary navigations to a cached server
// render, and prefetching every visible page number would fetch four extra
// documents on a page whose entire job is to be cheap.
//
// EVERY ACTIVE FILTER IS PRESERVED. A pagination control that drops the query
// string sends a visitor from "page 2 of my search" to "page 2 of everything"
// with no signal that it happened, which is worse than not paginating.

type SearchParams = { [key: string]: string | string[] | undefined };

type Props = {
  basePath: string;
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
};

/**
 * The page numbers to render, with nulls where an ellipsis goes.
 *
 * First and last are always present so the ends of the catalogue are one click
 * away, plus a window around the current page. Exported for the shape to be
 * readable on its own; the rule is "never more than 7 slots".
 */
export function paginationItems(currentPage: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 > 1) pages.add(currentPage - 1);
  if (currentPage + 1 < totalPages) pages.add(currentPage + 1);

  // Keep the row a constant width near the ends, where the window would
  // otherwise be clipped by the boundary and the control would visibly shrink.
  if (currentPage <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (currentPage >= totalPages - 2) {
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  }

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: (number | null)[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) items.push(null);
    items.push(page);
    previous = page;
  }
  return items;
}

export default function Pagination({ basePath, currentPage, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null;

  function pageUrl(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page') continue;
      if (typeof value === 'string') params.set(key, value);
    }
    // Page 1 is the bare URL. `?page=1` is the same page under a second
    // address, and the slugs on this site are live SEO URLs — one canonical
    // form for the first page is worth the branch.
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const items = paginationItems(currentPage, totalPages);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5 flex-wrap" aria-label="Paginación">
      {currentPage > 1 && (
        <a href={pageUrl(currentPage - 1)} rel="prev" className={navCls}>
          ← Anterior
        </a>
      )}

      {items.map((page, i) =>
        page === null ? (
          <span key={`gap-${i}`} className="px-2 text-sm text-ink-3" aria-hidden="true">
            …
          </span>
        ) : page === currentPage ? (
          // Text, not a link: a link to the page you are already on is a
          // dead control, and aria-current is what tells a screen reader
          // where it is.
          <span
            key={page}
            aria-current="page"
            className="px-3.5 py-2 rounded-[10px] border border-brand bg-brand-tint text-sm font-semibold text-brand"
          >
            {page}
          </span>
        ) : (
          <a
            key={page}
            href={pageUrl(page)}
            aria-label={`Página ${page}`}
            className="px-3.5 py-2 rounded-[10px] border border-border text-sm font-medium text-ink hover:border-brand hover:text-brand transition-colors"
          >
            {page}
          </a>
        ),
      )}

      {currentPage < totalPages && (
        <a href={pageUrl(currentPage + 1)} rel="next" className={navCls}>
          Siguiente →
        </a>
      )}
    </nav>
  );
}

const navCls =
  'px-4 py-2 rounded-[10px] border border-border text-sm font-medium text-ink hover:border-brand hover:text-brand transition-colors';
