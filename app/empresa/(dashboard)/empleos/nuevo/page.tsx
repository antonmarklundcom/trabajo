import type { Metadata } from 'next';
import { requireCompanyScope } from '@/lib/auth';
import { listCategoryOptions, listCityOptions } from '@/lib/db/taxonomy';
import EmployerJobForm from '@/components/empresa/EmployerJobForm';

export const metadata: Metadata = {
  title: 'Nuevo empleo — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function EmpresaNuevoEmpleoPage() {
  await requireCompanyScope();
  const [categories, cities] = await Promise.all([listCategoryOptions(), listCityOptions()]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Nuevo empleo</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-3xl">
        <EmployerJobForm categories={categories} cities={cities} />
      </div>
    </div>
  );
}
