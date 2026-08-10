import type { Metadata } from 'next';
import { listCategoryOptions, listCityOptions } from '@/lib/db/admin';
import PostForm from '@/components/admin/blog/PostForm';

export const metadata: Metadata = { title: 'Nuevo artículo — trabajo.com.py' };

export default async function NuevoArticuloPage() {
  const [jobCategories, jobCities] = await Promise.all([
    listCategoryOptions(),
    listCityOptions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Nuevo artículo</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <PostForm jobCategories={jobCategories} jobCities={jobCities} />
      </div>
    </div>
  );
}
