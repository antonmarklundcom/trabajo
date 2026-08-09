import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, homePathForRole } from '@/lib/auth';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Ingresar — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  // An already-logged-in employer goes to /empresa, not into the admin panel.
  if (user) redirect(homePathForRole(user.role));

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1E1B17]">trabajo.com.py</h1>
          <p className="text-sm text-[#57514A] mt-1">Panel de administración</p>
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
