import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listCategoryOptions, listCityOptions } from '@/lib/db/admin';
import { getAdminBlogPost } from '@/lib/db/blog-admin';
import { imagePublicUrl } from '@/lib/image-storage';
import PostForm, { type PostFormInitial } from '@/components/admin/blog/PostForm';

export const metadata: Metadata = { title: 'Editar artículo — trabajo.com.py' };

export default async function EditarArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [post, jobCategories, jobCities] = await Promise.all([
    getAdminBlogPost(id),
    listCategoryOptions(),
    listCityOptions(),
  ]);
  if (!post) notFound();

  const initial: PostFormInitial = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.description,
    category: post.category,
    bodyHtml: post.bodyHtml,
    featuredImageKey: post.featuredImageKey,
    featuredImageUrl: post.featuredImageKey ? imagePublicUrl(post.featuredImageKey) : null,
    relatedCategory: post.relatedCategory ?? '',
    relatedCity: post.relatedCity ?? '',
    published: post.published,
    originalSlug: post.slug,
    wasPublished: post.published,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Editar artículo</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <PostForm jobCategories={jobCategories} jobCities={jobCities} initial={initial} />
      </div>
    </div>
  );
}
