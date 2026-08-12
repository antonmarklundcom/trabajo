import type { Metadata } from 'next';
import { requireCompanyScope } from '@/lib/auth';
import { getEmployerCompany } from '@/lib/db/employer';
import { companyLogoSrc } from '@/lib/company-logo';
import CompanyProfileForm, {
  type CompanyProfileFormInitial,
} from '@/components/empresa/CompanyProfileForm';

export const metadata: Metadata = {
  title: 'Perfil de la empresa — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function EmpresaPerfilPage() {
  const { companyId } = await requireCompanyScope();
  const company = await getEmployerCompany(companyId);

  const initial: CompanyProfileFormInitial = {
    name: company?.name ?? '',
    logoSrc: company ? companyLogoSrc(company.logoKey, company.logoUrl) : null,
    logoKey: company?.logoKey ?? null,
    whatsapp: company?.whatsapp ?? '',
    website: company?.website ?? '',
    description: company?.description ?? '',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Perfil de la empresa</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-2xl">
        <CompanyProfileForm initial={initial} />
      </div>
    </div>
  );
}
