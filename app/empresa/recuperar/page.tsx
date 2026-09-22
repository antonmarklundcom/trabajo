import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, homePathForRole } from '@/lib/auth';
import ResetRequestForm from '@/components/postulante/ResetRequestForm';

// Under app/empresa/layout.tsx, which already 404s the tree while
// EMPLOYER_DASHBOARD_ENABLED is off.
export const metadata: Metadata = {
  title: 'Recuperar contraseña — Panel de empresas',
  robots: { index: false, follow: false },
};

export default async function EmpresaRecuperarPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-ink">trabajo.com.py</h1>
          <p className="text-sm text-ink-secondary mt-1">Recuperar contraseña — Panel de empresas</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          <ResetRequestForm basePath="/empresa" />
        </div>
      </div>
    </div>
  );
}
