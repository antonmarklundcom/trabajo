// A category archive, /blog/categoria/{categoria} (PLAN-GROWTH.md §4 C2).
//
// The seven categories are a closed set (lib/blog-categories.ts), so an
// unknown slug is a 404 before anything is read. A known category with no
// published post still renders — the pills and an article breadcrumb can
// point here the moment its last post is unpublished — but as
// `noindex, follow` and absent from the sitemap (blogArchiveRobots(),
// lib/seo.ts): a thin page that asks not to be indexed rather than a 404
// that flickers in and out of existence with each publish.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { blogArchiveRobots, blogListingCanonical, canonicalFor, siteUrl } from '@/lib/seo';
import { parsePageParam } from '@/lib/pagination';
import {
  BLOG_CATEGORY_COPY,
  blogCategoryPath,
  getBlogCategoryCounts,
  getBlogPostPage,
  isBlogCategory,
} from '@/lib/blog';
import BlogPostCard from '@/components/BlogPostCard';
import BlogCategoryNav from '@/components/BlogCategoryNav';
import Pagination from '@/components/Pagination';
import JsonLd from '@/components/JsonLd';

// Same arrangement as /blog: invalidateBlogContent() refreshes this route on
// every article write; the timer covers imports and scheduled posts.
export const revalidate = 300;

type Params = Promise<{ categoria: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { categoria } = await params;
  if (!isBlogCategory(categoria)) return { title: 'Categoría no encontrada' };

  const page = parsePageParam((await searchParams).page);
  const copy = BLOG_CATEGORY_COPY[categoria];
  const { total } = await getBlogPostPage({ category: categoria, page: 1 });

  return {
    title: page > 1 ? `${copy.title} — página ${page} | Blog` : `${copy.title} | Blog`,
    description: copy.description,
    robots: blogArchiveRobots(total),
    alternates: { canonical: canonicalFor(blogListingCanonical(blogCategoryPath(categoria), page)) },
  };
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { categoria } = await params;
  if (!isBlogCategory(categoria)) notFound();

  const sp = await searchParams;
  const page = parsePageParam(sp.page);

  const [{ posts, totalPages }, counts] = await Promise.all([
    getBlogPostPage({ category: categoria, page }),
    getBlogCategoryCounts(),
  ]);
  if (page > totalPages) notFound();

  const copy = BLOG_CATEGORY_COPY[categoria];
  const site = siteUrl();
  const path = blogCategoryPath(categoria);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site}/blog` },
      { '@type': 'ListItem', position: 3, name: copy.title, item: `${site}${path}` },
    ],
  };

  const itemListJsonLd = posts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${copy.title} — Blog de trabajo.com.py`,
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
          <Link href="/blog" className="hover:text-brand transition-colors">Blog</Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium">{copy.title}</span>
        </nav>

        <h1 className="text-3xl font-bold text-ink">
          {copy.title}
          {page > 1 && <span className="text-ink-3 font-medium"> · página {page}</span>}
        </h1>
        <p className="mt-2 text-ink-secondary max-w-2xl">{copy.intro}</p>

        <BlogCategoryNav counts={counts} active={categoria} />

        {posts.length === 0 ? (
          <div className="mt-10 rounded-[10px] border border-border bg-white px-6 py-10 text-center">
            <p className="text-ink-secondary">Todavía no hay artículos en esta categoría.</p>
            <Link href="/blog" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
              Ver todos los artículos del blog&nbsp;<span aria-hidden="true">→</span>
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
            <Pagination basePath={path} currentPage={page} totalPages={totalPages} searchParams={sp} />
          </>
        )}
      </div>
    </>
  );
}
