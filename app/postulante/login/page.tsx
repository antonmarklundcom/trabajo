import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCandidate } from '@/lib/auth-candidate';
import LoginForm from '@/components/postulante/LoginForm';

export const metadata: Metadata = {
  title: 'Ingresar — Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function PostulanteLoginPage() {
  const candidate = await getCandidate();
  if (candidate) redirect('/postulante/perfil');

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-ink">trabajo.com.py</h1>
          <p className="text-sm text-ink-secondary mt-1">Ingresar como postulante</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
