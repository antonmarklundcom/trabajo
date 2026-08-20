import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminCompanies } from '@/lib/db/admin';

export const metadata: Metadata = { title: 'Empresas — trabajo.com.py' };

export default async function AdminEmpresasPage() {
  const companies = await getAdminCompanies();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Empresas</h1>
          <p className="text-sm text-ink-secondary mt-1">{companies.length} empresa(s)</p>
        </div>
        <Link
          href="/admin/empresas/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
        >
          + Nueva empresa
        </Link>
      </div>

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Sitio web</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-ink-secondary">
                  Todavía no hay empresas registradas.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/empresas/${company.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{company.whatsapp || '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{company.website || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
