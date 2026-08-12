import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminBlogPost } from '@/lib/db/blog';
import { imagePublicUrl } from '@/lib/image-storage';
import BlogForm, { type BlogFormInitial } from '@/components/admin/BlogForm';
import BlogCoverUploader, { type BlogCoverInitial } from '@/components/admin/BlogCoverUploader';

export const metadata: Metadata = { title: 'Editar artículo — trabajo.com.py' };

export default async function EditarArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const post = await getAdminBlogPost(id);
  if (!post) notFound();

  const wasEverPublished = post.publishedAt !== null;

  const initial: BlogFormInitial = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.description,
    category: post.category,
    body: post.body,
    status: post.status,
    relatedCategory: post.relatedCategory ?? '',
    relatedCity: post.relatedCity ?? '',
    slugLocked: wasEverPublished,
  };

  const cover: BlogCoverInitial =
    post.coverImageKey && post.coverAlt && post.coverWidth && post.coverHeight
      ? {
          url: imagePublicUrl(post.coverImageKey),
          alt: post.coverAlt,
          width: post.coverWidth,
          height: post.coverHeight,
        }
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1E1B17]">Editar artículo</h1>
        {post.status === 'published' && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            className="text-sm font-medium text-[#C0362A] hover:underline"
          >
            Ver en el sitio ↗
          </Link>
        )}
        {post.status === 'draft' && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            className="text-sm font-medium text-[#C0362A] hover:underline"
          >
            Vista previa del borrador ↗
          </Link>
        )}
      </div>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <BlogForm initial={initial} />
      </div>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl mt-6">
        <h2 className="text-lg font-bold text-[#1E1B17] mb-4">Portada</h2>
        <BlogCoverUploader postId={post.id} initial={cover} />
      </div>
    </div>
  );
}
