import type { Metadata } from 'next';
import { listCategoryOptions, listCityOptions, listCompanyOptions } from '@/lib/db/admin';
import JobForm from '@/components/admin/JobForm';

export const metadata: Metadata = { title: 'Nuevo empleo — trabajo.com.py' };

export default async function NuevoEmpleoPage() {
  const [companies, categories, cities] = await Promise.all([
    listCompanyOptions(),
    listCategoryOptions(),
    listCityOptions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Nuevo empleo</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-3xl">
        <JobForm companies={companies} categories={categories} cities={cities} />
      </div>
    </div>
  );
}
