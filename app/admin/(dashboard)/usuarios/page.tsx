import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSessionWithRole } from '@/lib/auth';
import { getAdminUsers } from '@/lib/db/admin';

export const metadata: Metadata = { title: 'Usuarios — trabajo.com.py' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  employer: 'Empleador',
};

export default async function AdminUsuariosPage() {
  await requireSessionWithRole(['admin']);
  const users = await getAdminUsers();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E1B17]">Usuarios</h1>
          <p className="text-sm text-[#57514A] mt-1">{users.length} usuario(s)</p>
        </div>
        <Link
          href="/admin/usuarios/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E1D6] text-left text-xs uppercase tracking-wider text-[#57514A]">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E1D6]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-[#F5F1EA]">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/usuarios/${u.id}`}
                    className="font-medium text-[#1E1B17] hover:text-[#C0362A]"
                  >
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#57514A]">{u.email}</td>
                <td className="px-4 py-3 text-[#57514A]">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-3 text-[#57514A]">{u.companyName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-[#E8F3EC] text-[#2E7D50]' : 'bg-[#F5F1EA] text-[#8A8378]'
                    }`}
                  >
                    {u.isActive ? 'Activo' : 'Deshabilitado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
