import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAdminCompany } from '@/lib/db/admin';
import CompanyForm, { type CompanyFormInitial } from '@/components/admin/CompanyForm';

export const metadata: Metadata = { title: 'Editar empresa — trabajo.com.py' };

export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const company = await getAdminCompany(id);
  if (!company) notFound();

  const initial: CompanyFormInitial = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl ?? '',
    whatsapp: company.whatsapp ?? '',
    website: company.website ?? '',
    description: company.description ?? '',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Editar empresa</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-2xl">
        <CompanyForm initial={initial} />
      </div>
    </div>
  );
}
