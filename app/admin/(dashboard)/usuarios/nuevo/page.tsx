import type { Metadata } from 'next';
import { requireSessionWithRole } from '@/lib/auth';
import { listCompanyOptions } from '@/lib/db/admin';
import UserForm from '@/components/admin/UserForm';

export const metadata: Metadata = { title: 'Nuevo usuario — trabajo.com.py' };

export default async function NuevoUsuarioPage() {
  const session = await requireSessionWithRole(['admin']);
  const companies = await listCompanyOptions();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Nuevo usuario</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-2xl">
        <UserForm companies={companies} currentUserId={session.id} />
      </div>
    </div>
  );
}
