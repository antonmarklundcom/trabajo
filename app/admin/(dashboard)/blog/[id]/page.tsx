import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminBlogPost, listBlogRedirects } from '@/lib/db/blog';
import { listCategoryOptions, listCityOptions } from '@/lib/db/taxonomy';
import { blogCoverUrl } from '@/lib/blog';
import BlogPostForm, { type BlogPostFormInitial } from '@/components/admin/BlogPostForm';
import BlogCoverUploader from '@/components/admin/BlogCoverUploader';
import BlogDeleteButton from '@/components/admin/BlogDeleteButton';

export const metadata: Metadata = { title: 'Editar artículo — trabajo.com.py' };

export default async function EditarArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [post, categories, cities] = await Promise.all([
    getAdminBlogPost(id),
    listCategoryOptions(),
    listCityOptions(),
  ]);
  if (!post) notFound();

  const redirects = await listBlogRedirects(id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const initial: BlogPostFormInitial = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.description,
    body: post.body,
    category: post.category,
    status: post.status,
    publishedAt: post.publishedAt ?? '',
    relatedCategory: post.relatedCategorySlug ?? '',
    relatedCity: post.relatedCitySlug ?? '',
    originalSlug: post.slug,
    originalStatus: post.status,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-[#1E1B17]">Editar artículo</h1>
        {post.status === 'published' && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#C0362A] hover:underline"
          >
            Ver publicado ↗
          </Link>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <BlogPostForm
          categories={categories}
          cities={cities}
          initial={initial}
          siteUrl={siteUrl}
        />
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl mt-6">
        <h2 className="text-lg font-bold text-[#1E1B17] mb-1">Portada</h2>
        <p className="text-sm text-[#57514A] mb-4">
          Se muestra arriba del artículo y como imagen del artículo para Google. Opcional.
        </p>
        <BlogCoverUploader
          postId={post.id}
          initialUrl={post.coverImageKey ? blogCoverUrl(post.coverImageKey) : null}
          initialAlt={post.coverAlt}
        />
      </div>

      {redirects.length > 0 && (
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl mt-6">
          <h2 className="text-lg font-bold text-[#1E1B17] mb-1">URLs anteriores</h2>
          <p className="text-sm text-[#57514A] mb-4">
            Estas direcciones redirigen con un 301 hacia <span className="font-medium">/blog/{post.slug}</span>.
            Se crean solas cada vez que cambiás el slug de un artículo publicado.
          </p>
          <ul className="text-sm text-[#57514A] space-y-1">
            {redirects.map((redirect) => (
              <li key={redirect.id}>
                <code className="text-[#1E1B17]">/blog/{redirect.fromSlug}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-3xl mt-6">
        <BlogDeleteButton postId={post.id} slug={post.slug} />
      </div>
    </div>
  );
}
