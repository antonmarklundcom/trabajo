import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCandidate } from '@/lib/auth-candidate';
import { listCityOptions } from '@/lib/db/taxonomy';
import RegistroForm from '@/components/postulante/RegistroForm';

export const metadata: Metadata = {
  title: 'Crear cuenta de postulante — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function PostulanteRegistroPage() {
  const candidate = await getCandidate();
  if (candidate) redirect('/postulante/perfil');

  const cities = await listCityOptions();

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1E1B17]">trabajo.com.py</h1>
          <p className="text-sm text-[#57514A] mt-1">Crear cuenta de postulante</p>
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          <RegistroForm cities={cities} />
        </div>
      </div>
    </div>
  );
}
