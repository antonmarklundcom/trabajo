import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { candidateAccountsEnabled } from '@/lib/flags';
import VerifyEmail from '@/components/postulante/VerifyEmail';

export const metadata: Metadata = {
  title: 'Confirmar email — Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  if (!candidateAccountsEnabled()) notFound();

  const sp = await searchParams;
  const raw = sp.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-ink">trabajo.com.py</h1>
          <p className="text-sm text-ink-secondary mt-1">Confirmar email</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          {token ? (
            <VerifyEmail token={token} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-brand">Este enlace no es válido.</p>
              <Link href="/postulante/login" className="block text-sm text-brand hover:underline">
                Ingresar
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
