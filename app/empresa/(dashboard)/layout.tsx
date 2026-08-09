import { requireCompanyScope } from '@/lib/auth';
import { getEmployerCompany } from '@/lib/db/employer';
import EmpresaNav from '@/components/empresa/EmpresaNav';

// Every route under this group requires an employer session scoped to a
// company (PLAN-PHASE2.md §2.3) — requireCompanyScope() redirects to
// /empresa/login otherwise, and to /empresa/login?error=sin_empresa for an
// employer whose company_id is NULL rather than rendering an empty dashboard.
export default async function EmpresaDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, companyId } = await requireCompanyScope();
  const company = await getEmployerCompany(companyId);

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <EmpresaNav name={user.name} companyName={company?.name ?? 'trabajo.com.py'} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
