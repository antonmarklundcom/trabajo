// The blog's linking surfaces on pages whose subject is not the blog — a job,
// a taxonomy landing, the homepage, the employer pages (PLAN-GROWTH.md §4 C2,
// "the point of the batch"). Internal links from pages that already rank are
// what give a new article a way in.
//
// Renders nothing when handed no posts: every caller's block simply does not
// exist until there is something to put in it, which is also what a
// database-less build (CI, DATA_SOURCE=seed) shows.
import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import BlogPostCard from './BlogPostCard';

type Props = {
  title: string;
  posts: BlogPostMeta[];
  /** Optional "see more" target — an archive, or /blog. */
  moreHref?: string;
  moreLabel?: string;
  /** `quiet` is the "Leé más" row under the employer cards: smaller heading. */
  tone?: 'default' | 'quiet';
  className?: string;
};

export default function BlogPostLinks({
  title,
  posts,
  moreHref,
  moreLabel = 'Ver más artículos',
  tone = 'default',
  className = '',
}: Props) {
  if (posts.length === 0) return null;

  const columns =
    posts.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : posts.length === 2 ? 'sm:grid-cols-2' : '';

  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2
          className={
            tone === 'quiet'
              ? 'text-sm font-semibold text-ink-secondary uppercase tracking-wide'
              : 'text-lg font-bold text-ink'
          }
        >
          {title}
        </h2>
        {moreHref && (
          <Link href={moreHref} className="shrink-0 text-sm font-medium text-brand hover:underline">
            {moreLabel}&nbsp;<span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <ul className={`grid grid-cols-1 gap-3 ${columns}`}>
        {posts.map((post) => (
          <li key={post.slug}>
            <BlogPostCard post={post} headingLevel="h3" compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
