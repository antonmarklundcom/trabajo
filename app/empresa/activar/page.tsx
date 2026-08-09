import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, homePathForRole } from '@/lib/auth';
import { getInvitationByToken } from '@/lib/db/employer-invitations';
import ActivationForm from '@/components/empresa/ActivationForm';

export const metadata: Metadata = {
  title: 'Activar cuenta — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function EmpresaActivarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathForRole(user.role));

  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';

  // The lookup does not consume the invitation — only acceptInvitation()
  // (called from the API route on submit) claims it, and it re-validates
  // everything checked here rather than trusting this read.
  const invitation = token ? await getInvitationByToken(token) : null;

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1E1B17]">trabajo.com.py</h1>
          <p className="text-sm text-[#57514A] mt-1">Activar cuenta de empresa</p>
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8">
          {invitation ? (
            <ActivationForm
              token={token}
              email={invitation.email}
              companyName={invitation.companyName}
            />
          ) : (
            <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">
              Este enlace de invitación no es válido o ya venció. Pedile al equipo de
              trabajo.com.py que te envíe uno nuevo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
