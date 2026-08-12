import type { Metadata } from 'next';
import Link from 'next/link';
import { getBlogPosts, BLOG_CATEGORY_LABELS } from '@/lib/blog';

// Five minutes, matching PUBLIC_CACHE_TTL_SECONDS in lib/cache-tags.ts.
//
// Freshness after an edit in /admin does NOT come from this timer — it comes
// from invalidateBlogContent(). The timer covers the writes that happen OUTSIDE
// a request and therefore have no revalidation hook to fire: `npm run
// blog:import` at cutover, and any future one-off script. Without it this page
// prerenders at build time (with no database, so: empty) and would keep serving
// that until someone happened to edit an article.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Consejos de carrera, análisis del mercado laboral y novedades del portal de empleos de Paraguay.',
  robots: { index: true, follow: true },
};

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
    ],
  };

  const itemListJsonLd = posts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Blog de trabajo.com.py',
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/blog/${post.slug}`,
      name: post.title,
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="flex items-center gap-2 text-sm text-[#57514A] mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-[#C0362A] transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <span className="text-[#1E1B17] font-medium">Blog</span>
        </nav>

        <h1 className="text-3xl font-bold text-[#1E1B17]">Blog</h1>
        <p className="mt-2 text-[#57514A]">
          Consejos de carrera, análisis del mercado laboral y novedades de trabajo.com.py.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-[#57514A]">Todavía no hay artículos publicados.</p>
        ) : (
          <ul className="mt-10 flex flex-col gap-6">
            {posts.map((post) => (
              <li key={post.slug}>
                <article className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 hover:shadow-[0_4px_12px_-2px_rgba(30,27,23,.12)] transition-shadow">
                  <Link href={`/blog/${post.slug}`} className="block">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F1EA] text-[#57514A] border border-[#E7E1D6]">
                        {BLOG_CATEGORY_LABELS[post.category]}
                      </span>
                      <time dateTime={post.publishedAt} className="text-xs text-[#8A8378] uppercase tracking-wide font-medium">
                        {formatDate(post.publishedAt)}
                      </time>
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-[#1E1B17]">{post.title}</h2>
                    <p className="mt-2 text-[#57514A]">{post.description}</p>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
