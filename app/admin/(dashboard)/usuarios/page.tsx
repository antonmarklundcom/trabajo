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
          <h1 className="text-2xl font-bold text-ink">Usuarios</h1>
          <p className="text-sm text-ink-secondary mt-1">{users.length} usuario(s)</p>
        </div>
        <Link
          href="/admin/usuarios/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/usuarios/${u.id}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-secondary">{u.email}</td>
                <td className="px-4 py-3 text-ink-secondary">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-3 text-ink-secondary">{u.companyName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-success-tint text-success' : 'bg-surface-2 text-ink-3'
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
