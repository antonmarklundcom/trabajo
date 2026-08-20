import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSessionWithRole } from '@/lib/auth';
import { getAdminCompany } from '@/lib/db/admin';
import { companyLogoSrc } from '@/lib/company-logo';
import { listEmployerInvitations } from '@/lib/db/employer-invitations';
import CompanyForm, { type CompanyFormInitial } from '@/components/admin/CompanyForm';
import EmployerInvitationForm from '@/components/admin/EmployerInvitationForm';

export const metadata: Metadata = { title: 'Editar empresa — trabajo.com.py' };

export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionWithRole(['admin', 'editor']);

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const company = await getAdminCompany(id);
  if (!company) notFound();

  const initial: CompanyFormInitial = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoSrc: companyLogoSrc(company.logoKey, company.logoUrl),
    logoKey: company.logoKey,
    whatsapp: company.whatsapp ?? '',
    website: company.website ?? '',
    description: company.description ?? '',
  };

  const invitations = user.role === 'admin' ? await listEmployerInvitations(id) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Editar empresa</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-2xl">
        <CompanyForm initial={initial} />
      </div>

      {user.role === 'admin' && (
        <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-2xl mt-6">
          <h2 className="font-semibold text-ink mb-1">Acceso de la empresa</h2>
          <p className="text-sm text-ink-secondary mb-4">
            Invitá a alguien de esta empresa a usar el panel de empleadores. El enlace vence a los 7
            días y solo puede usarse una vez.
          </p>
          <EmployerInvitationForm companyId={id} />

          {invitations.length > 0 && (
            <ul className="divide-y divide-border mt-6">
              {invitations.map((inv) => (
                <li key={inv.id} className="py-3 text-sm flex items-center justify-between gap-4">
                  <span className="text-ink">{inv.email}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      inv.acceptedAt
                        ? 'bg-success-tint text-success'
                        : new Date(inv.expiresAt) < new Date()
                          ? 'bg-surface-2 text-ink-3'
                          : 'bg-gold-tint text-gold-strong'
                    }`}
                  >
                    {inv.acceptedAt
                      ? 'Aceptada'
                      : new Date(inv.expiresAt) < new Date()
                        ? 'Vencida'
                        : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
