import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getBlogPost,
  getBlogSlugs,
  blogCoverUrl,
  BLOG_COVER_WIDTH,
  BLOG_COVER_HEIGHT,
  type BlogCategory,
} from '@/lib/blog';
import { getJobs } from '@/lib/data';
import JobCard from '@/components/JobCard';
import CopyLinkButton from '@/components/blog/CopyLinkButton';

type Params = Promise<{ slug: string }>;

const CATEGORY_LABELS: Record<BlogCategory, string> = {
  noticias: 'Noticias',
  'analisis-laboral': 'Análisis laboral',
  'consejos-cv': 'Consejos de CV',
};

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: 'Artículo no encontrado' };

  return {
    title: post.title,
    description: post.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

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
    author: { '@type': 'Organization', name: 'trabajo.com.py' },
    // Omitted entirely when there is no cover, rather than emitted empty:
    // schema.org consumers treat a present-but-blank `image` as a broken
    // article, which is worse than an article that simply does not declare one.
    ...(post.coverImage ? { image: [`${siteUrl}${blogCoverUrl(post.coverImage)}`] } : {}),
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
        <nav className="flex items-center gap-2 text-sm text-[#57514A] mb-6" aria-label="Ruta">
          <Link href="/" className="hover:text-[#C0362A] transition-colors">Inicio</Link>
          <span aria-hidden="true">›</span>
          <Link href="/blog" className="hover:text-[#C0362A] transition-colors">Blog</Link>
          <span aria-hidden="true">›</span>
          <span className="text-[#1E1B17] font-medium truncate max-w-xs">{post.title}</span>
        </nav>

        <article className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          {post.coverImage && (
            // Plain <img>, not next/image: PLAN-IMAGES.md §6 declined loader
            // integration and nothing here needs it. Dimensions are constants
            // because every cover is exactly 1600x900 (asserted by
            // scripts/verify-blog.ts), so the browser reserves the box before
            // the bytes arrive and this never shifts the layout. It is the LCP
            // element, so it is eager and high priority.
            <img
              src={blogCoverUrl(post.coverImage)}
              alt={post.coverAlt}
              width={BLOG_COVER_WIDTH}
              height={BLOG_COVER_HEIGHT}
              fetchPriority="high"
              className="w-full h-auto mb-6 rounded-[10px] border border-[#E7E1D6]"
            />
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F1EA] text-[#57514A] border border-[#E7E1D6]">
              {CATEGORY_LABELS[post.category]}
            </span>
            <time dateTime={post.publishedAt} className="text-xs text-[#8A8378] uppercase tracking-wide font-medium">
              {formatDate(post.publishedAt)}
            </time>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[#1E1B17] leading-tight">
            {post.title}
          </h1>

          <div
            className="prose-blog mt-6"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>

        <div className="mt-6 bg-white rounded-[10px] border border-[#E7E1D6] p-6">
          <h2 className="text-sm font-bold text-[#1E1B17] mb-3">Compartir</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${postUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C0362A] font-medium hover:underline"
            >
              WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C0362A] font-medium hover:underline"
            >
              Facebook
            </a>
            <CopyLinkButton url={postUrl} />
          </div>
        </div>

        {relatedJobs.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-[#1E1B17] mb-4">Empleos relacionados</h2>
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
