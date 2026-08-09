import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, homePathForRole } from '@/lib/auth';
import LoginForm from '@/components/empresa/LoginForm';

export const metadata: Metadata = {
  title: 'Ingresar — Panel de empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function EmpresaLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  // An already-logged-in admin/editor goes to /admin, not into this panel.
  if (user) redirect(homePathForRole(user.role));

  const sp = await searchParams;
  const error = typeof sp.error === 'string' ? sp.error : undefined;

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1E1B17]">trabajo.com.py</h1>
          <p className="text-sm text-[#57514A] mt-1">Panel de empresas</p>
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          {error === 'sin_empresa' && (
            <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3 mb-4">
              Tu cuenta no tiene una empresa asignada. Contactá al equipo de trabajo.com.py para
              resolverlo.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
