import type { Metadata } from 'next';
import { listCategoryOptions, listCityOptions } from '@/lib/db/taxonomy';
import BlogPostForm from '@/components/admin/BlogPostForm';

export const metadata: Metadata = { title: 'Nuevo artículo — trabajo.com.py' };

export default async function NuevoArticuloPage() {
  const [categories, cities] = await Promise.all([listCategoryOptions(), listCityOptions()]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Nuevo artículo</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <BlogPostForm categories={categories} cities={cities} siteUrl={siteUrl} />
      </div>
      <p className="text-sm text-[#57514A] mt-4 max-w-3xl">
        La portada se sube después de guardar, desde la pantalla de edición.
      </p>
    </div>
  );
}
