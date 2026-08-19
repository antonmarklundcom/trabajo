import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import ResetRequestForm from '@/components/postulante/ResetRequestForm';

export const metadata: Metadata = {
  title: 'Recuperar contraseña — Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function RecuperarPage() {
  if (!candidateAccountsEnabled()) notFound();

  const candidate = await getCandidate();
  if (candidate) redirect('/postulante/perfil');

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1E1B17]">trabajo.com.py</h1>
          <p className="text-sm text-[#57514A] mt-1">Recuperar contraseña</p>
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          <ResetRequestForm />
        </div>
      </div>
    </div>
  );
}
