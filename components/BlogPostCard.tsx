// One article in a list — /blog, a category archive, "Artículos relacionados"
// and the blog blocks on job and landing pages (PLAN-GROWTH.md §4 C2).
//
// Presentational only: it is handed a BlogPostMeta that lib/blog.ts already
// read through publishedPredicate(), and it reads nothing itself. The type
// import below is erased at compile time, so this file does not pull the
// server-only read path into anything that renders it.
import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import { BLOG_CATEGORY_LABELS } from '@/lib/blog-categories';

type Props = {
  post: BlogPostMeta;
  /** h2 on a listing whose h1 is the list itself; h3 inside a titled block. */
  headingLevel?: 'h2' | 'h3';
  /** Text-only, tighter: for blocks on pages whose subject is not the blog. */
  compact?: boolean;
};

export default function BlogPostCard({ post, headingLevel = 'h2', compact = false }: Props) {
  const Heading = headingLevel;

  if (compact) {
    return (
      <article className="h-full bg-white rounded-[10px] border border-border hover:border-brand/40 transition-colors">
        <Link href={`/blog/${post.slug}`} className="block h-full p-4">
          <span className="text-xs font-medium text-ink-3 uppercase tracking-wide">
            {BLOG_CATEGORY_LABELS[post.category]}
          </span>
          <Heading className="mt-1 text-base font-semibold text-ink leading-snug">{post.title}</Heading>
          <p className="mt-1 text-sm text-ink-secondary line-clamp-2">{post.description}</p>
        </Link>
      </article>
    );
  }

  return (
    <article className="bg-white rounded-[10px] border border-border hover:shadow-[0_4px_12px_-2px_rgba(30,27,23,.12)] transition-shadow">
      <Link href={`/blog/${post.slug}`} className="flex gap-4 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-ink-secondary border border-border">
              {BLOG_CATEGORY_LABELS[post.category]}
            </span>
            <time dateTime={post.publishedAt} className="text-xs text-ink-3 uppercase tracking-wide font-medium">
              {formatBlogDate(post.publishedAt)}
            </time>
          </div>
          <Heading className="mt-2 text-lg sm:text-xl font-bold text-ink leading-snug">{post.title}</Heading>
          <p className="mt-2 text-sm sm:text-base text-ink-secondary line-clamp-3">{post.description}</p>
        </div>
        {post.coverUrl && (
          // Plain <img>, as on the article page (PLAN-IMAGES.md §6). Lazy and
          // sized: below the fold on every list it appears in, and the
          // explicit box keeps the card from shifting when it loads. Empty alt:
          // the title right beside it already says what the link is.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={180}
            className="shrink-0 self-start w-24 h-24 sm:w-40 sm:h-[90px] object-cover rounded-[8px] border border-border"
          />
        )}
      </Link>
    </article>
  );
}

/** `2026-09-27` → `27 de septiembre de 2026`. */
export function formatBlogDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
