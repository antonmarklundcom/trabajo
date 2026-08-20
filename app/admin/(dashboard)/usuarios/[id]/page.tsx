import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSessionWithRole } from '@/lib/auth';
import { getAdminUser, listCompanyOptions } from '@/lib/db/admin';
import UserForm, { type UserFormInitial } from '@/components/admin/UserForm';

export const metadata: Metadata = { title: 'Editar usuario — trabajo.com.py' };

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSessionWithRole(['admin']);

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [target, companies] = await Promise.all([getAdminUser(id), listCompanyOptions()]);
  if (!target) notFound();

  const initial: UserFormInitial = {
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
    companyId: target.companyId ?? '',
    isActive: target.isActive,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Editar usuario</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-2xl">
        <UserForm companies={companies} initial={initial} currentUserId={session.id} />
      </div>
    </div>
  );
}
