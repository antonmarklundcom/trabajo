import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser, homePathForRole } from '@/lib/auth';
import { employerSignupEnabled } from '@/lib/flags';
import SignupForm from '@/components/empresa/SignupForm';

export const metadata: Metadata = {
  title: 'Crear cuenta — Panel de empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function EmpresaRegistroPage() {
  // The session read comes FIRST, and the order is load-bearing rather than
  // stylistic. getSessionUser() reaches cookies(), a request-time API, which is
  // what opts this route out of prerendering. Checking the flag first would let
  // notFound() short-circuit before that call on a build where signup is off —
  // and the route would then be prerendered as a static 404, so flipping
  // EMPLOYER_SIGNUP_ENABLED in hPanel would do nothing until the next build.
  const user = await getSessionUser();
  if (user) redirect(homePathForRole(user.role));

  // app/empresa/layout.tsx already 404s the tree when the dashboard is off;
  // this is the second half — signup can be dark while invited employers keep
  // using their panel (lib/flags.ts).
  if (!employerSignupEnabled()) notFound();

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-ink">trabajo.com.py</h1>
          <p className="text-sm text-ink-secondary mt-1">Crear cuenta de empresa</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-secondary">
          ¿Preferís que publiquemos por vos?{' '}
          <Link href="/publicar" className="text-brand hover:underline">
            Dejanos tus datos
          </Link>{' '}
          y nuestro equipo te contacta.
        </p>
      </div>
    </div>
  );
}
