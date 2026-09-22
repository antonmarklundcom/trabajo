import type { Metadata } from 'next';
import Link from 'next/link';
import ResetConfirmForm from '@/components/postulante/ResetConfirmForm';

export const metadata: Metadata = {
  title: 'Nueva contraseña — Panel de empresas',
  robots: { index: false, follow: false },
};

export default async function EmpresaRecuperarConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-ink">trabajo.com.py</h1>
          <p className="text-sm text-ink-secondary mt-1">Elegí una contraseña nueva</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          {token ? (
            <ResetConfirmForm token={token} basePath="/empresa" />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-brand">Este enlace no es válido.</p>
              <Link href="/empresa/recuperar" className="block text-sm text-brand hover:underline">
                Pedir un enlace nuevo
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
