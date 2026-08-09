import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireCompanyScope } from '@/lib/auth';
import { getEmployerJob } from '@/lib/db/employer';
import { listCategoryOptions, listCityOptions } from '@/lib/db/taxonomy';
import EmployerJobForm, { type EmployerJobFormInitial } from '@/components/empresa/EmployerJobForm';

export const metadata: Metadata = {
  title: 'Editar empleo — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function EmpresaEditarEmpleoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { companyId } = await requireCompanyScope();

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [job, categories, cities] = await Promise.all([
    getEmployerJob(companyId, id),
    listCategoryOptions(),
    listCityOptions(),
  ]);
  if (!job) notFound();

  const initial: EmployerJobFormInitial = {
    id: job.id,
    title: job.title,
    categoryId: job.categoryId,
    cityId: job.cityId,
    contractType: job.contractType,
    seniority: job.seniority,
    modality: job.modality,
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    salaryHidden: job.salaryHidden,
    description: job.description,
    whatsapp: job.whatsapp ?? '',
    status: job.status,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Editar empleo</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <EmployerJobForm categories={categories} cities={cities} initial={initial} />
      </div>
    </div>
  );
}
