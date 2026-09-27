import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { blogListingCanonical, canonicalFor, siteUrl } from '@/lib/seo';
import { parsePageParam } from '@/lib/pagination';
import { getBlogCategoryCounts, getBlogPostPage } from '@/lib/blog';
import BlogPostCard from '@/components/BlogPostCard';
import BlogCategoryNav from '@/components/BlogCategoryNav';
import Pagination from '@/components/Pagination';
import JsonLd from '@/components/JsonLd';

// Five minutes, matching PUBLIC_CACHE_TTL_SECONDS in lib/cache-tags.ts.
//
// Freshness after an edit in /admin does NOT come from this timer — it comes
// from invalidateBlogContent(). The timer covers what happens OUTSIDE a
// request: `npm run blog:import`, and a scheduled post reaching its date
// (lib/db/blog.ts publishedPredicate()). Reading `?page=` makes this route
// render per request (as the paginated taxonomy landings already do); the
// queries underneath are still cached under the `public-blog` tag.
export const revalidate = 300;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const DESCRIPTION =
  'Consejos de carrera, análisis del mercado laboral y novedades del portal de empleos de Paraguay.';

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = parsePageParam((await searchParams).page);
  return {
    title: page > 1 ? `Blog — página ${page}` : 'Blog',
    description: DESCRIPTION,
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalFor(blogListingCanonical('/blog', page)) },
  };
}

export default async function BlogIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = parsePageParam(sp.page);

  const [{ posts, totalPages }, counts] = await Promise.all([
    getBlogPostPage({ page }),
    getBlogCategoryCounts(),
  ]);

  // Past the last page is a 404, not an empty indexable 200 — same rule as
  // the taxonomy landings.
  if (page > totalPages) notFound();

  const site = siteUrl();

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site}/blog` },
    ],
  };

  // This page's posts only — an ItemList describes the list on the page it
  // is on, and with pagination that is no longer "every post".
  const itemListJsonLd = posts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Blog de trabajo.com.py',
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${site}/blog/${post.slug}`,
      name: post.title,
    })),
  } : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {itemListJsonLd && (
        <JsonLd data={itemListJsonLd} />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-brand transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium">Blog</span>
        </nav>

        <h1 className="text-3xl font-bold text-ink">
          Blog{page > 1 && <span className="text-ink-3 font-medium"> · página {page}</span>}
        </h1>
        <p className="mt-2 text-ink-secondary">
          Consejos de carrera, análisis del mercado laboral y novedades de trabajo.com.py.
        </p>

        <BlogCategoryNav counts={counts} />

        {posts.length === 0 ? (
          <div className="mt-10 rounded-[10px] border border-border bg-white px-6 py-10 text-center">
            <p className="text-ink-secondary">Todavía no hay artículos publicados.</p>
            <Link href="/empleos" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
              Mientras tanto, mirá los empleos publicados&nbsp;<span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 flex flex-col gap-4 sm:gap-6">
              {posts.map((post) => (
                <li key={post.slug}>
                  <BlogPostCard post={post} />
                </li>
              ))}
            </ul>
            <Pagination basePath="/blog" currentPage={page} totalPages={totalPages} searchParams={sp} />
          </>
        )}
      </div>
    </>
  );
}
