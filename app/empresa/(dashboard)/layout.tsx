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
    <div className="min-h-screen bg-page-bg flex flex-col">
      <EmpresaNav name={user.name} companyName={company?.name ?? 'trabajo.com.py'} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">{children}</main>
      {/* PLAN-PHASE2.md §7 item 6 — persistent, on every /empresa/(dashboard)
          page, not just the activation screen. */}
      <footer className="border-t border-border bg-white">
        <p className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-ink-3">
          Los datos de los postulantes se comparten únicamente para la vacante a la que se
          postularon. trabajo.com.py no selecciona, evalúa ni recomienda candidatos.
        </p>
      </footer>
    </div>
  );
}
