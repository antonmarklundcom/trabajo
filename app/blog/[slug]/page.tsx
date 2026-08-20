import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import {
  getBlogPost,
  getBlogRedirect,
  getBlogSlugs,
  BLOG_CATEGORY_LABELS,
} from '@/lib/blog';
import { getJobs } from '@/lib/data';
import JobCard from '@/components/JobCard';
import ShareLinks from '@/components/ShareLinks';

type Params = Promise<{ slug: string }>;

// Same reasoning as /blog: invalidateBlogContent() handles admin edits, this
// timer covers writes made outside a request (the cutover import). It also
// bounds how long an on-demand render is reused — generateStaticParams returns
// nothing during a database-less build, so in practice every article is
// rendered on demand rather than prerendered.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: 'Artículo no encontrado' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  // Absolute, because a crawler that reached this page through a retired slug
  // has to be told which URL is the real one.
  const coverUrl = post.coverUrl ? `${siteUrl}${post.coverUrl}` : undefined;

  return {
    title: post.title,
    description: post.description,
    robots: { index: true, follow: true },
    alternates: { canonical: postUrl },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: postUrl,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(coverUrl ? { images: [{ url: coverUrl, alt: post.coverAlt ?? post.title }] } : {}),
    },
    twitter: {
      card: coverUrl ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.description,
      ...(coverUrl ? { images: [coverUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    // Only after the live lookup missed: a published post always wins over a
    // retired slug, so the two can never both answer. 308 via permanentRedirect
    // — Next's permanent redirect — which crawlers treat as a 301 does for
    // consolidating the old URL's authority into the new one.
    const target = await getBlogRedirect(slug);
    if (target) permanentRedirect(`/blog/${target}`);
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  const relatedJobs =
    post.relatedCategory || post.relatedCity
      ? (
          await getJobs({
            categoria: post.relatedCategory,
            ciudad: post.relatedCity,
            orden: 'recientes',
          })
        ).jobs.slice(0, 5)
      : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: postUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    author: { '@type': 'Organization', name: 'trabajo.com.py' },
    publisher: { '@type': 'Organization', name: 'trabajo.com.py' },
    // Omitted entirely when there is no cover — an `image: null` is worse than
    // no field, because it asserts the article has no image rather than saying
    // nothing about one.
    ...(post.coverUrl ? { image: [`${siteUrl}${post.coverUrl}`] } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="flex items-center gap-2 text-sm text-ink-secondary mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-brand transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link href="/blog" className="hover:text-brand transition-colors">Blog</Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium truncate max-w-xs">{post.title}</span>
        </nav>

        <article className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          {post.coverUrl && (
            // Plain <img>, not next/image: PLAN-IMAGES.md §6 declined loader
            // integration and nothing here needs it. No `loading="lazy"` — this
            // is the page's LCP element.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverUrl}
              alt={post.coverAlt ?? ''}
              fetchPriority="high"
              className="w-full aspect-video object-cover rounded-[10px] border border-border mb-6"
            />
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-ink-secondary border border-border">
              {BLOG_CATEGORY_LABELS[post.category]}
            </span>
            <time dateTime={post.publishedAt} className="text-xs text-ink-3 uppercase tracking-wide font-medium">
              {formatDate(post.publishedAt)}
            </time>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-ink leading-tight">
            {post.title}
          </h1>

          <div
            className="prose-blog mt-6"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>

        <ShareLinks title={post.title} url={postUrl} className="mt-6" />

        {relatedJobs.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-ink mb-4">Empleos relacionados</h2>
            <div className="flex flex-col gap-4">
              {relatedJobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .prose-blog p { margin-bottom: 1rem; color: #44403A; line-height: 1.75; }
        .prose-blog h2 { font-size: 1.35rem; font-weight: 700; color: #1E1B17; margin: 1.75rem 0 0.75rem; }
        .prose-blog h3 { font-size: 1.15rem; font-weight: 600; color: #1E1B17; margin: 1.5rem 0 0.5rem; }
        .prose-blog ul, .prose-blog ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .prose-blog ul { list-style: disc; }
        .prose-blog ol { list-style: decimal; }
        .prose-blog li { margin-bottom: 0.375rem; color: #44403A; line-height: 1.7; }
        .prose-blog strong { color: #1E1B17; font-weight: 600; }
        .prose-blog a { color: #C0362A; text-decoration: underline; }
        .prose-blog code { background: #F5F1EA; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
        .prose-blog pre { background: #1E1B17; color: #FBF9F6; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1rem; }
        .prose-blog pre code { background: none; padding: 0; }
        .prose-blog table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .prose-blog th, .prose-blog td { border: 1px solid #E7E1D6; padding: 0.5rem 0.75rem; text-align: left; }
      `}</style>
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
