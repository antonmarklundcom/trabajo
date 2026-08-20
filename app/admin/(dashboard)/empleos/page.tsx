import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminJobs, type AdminJobFilters } from '@/lib/db/admin';
import { jobStatusEnum } from '@/lib/db/schema';
import EmpleosFilterBar from '@/components/admin/EmpleosFilterBar';
import StatusBadge from '@/components/admin/StatusBadge';

export const metadata: Metadata = { title: 'Empleos — trabajo.com.py' };

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function AdminEmpleosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusParam = param(sp, 'status');
  const status = jobStatusEnum.find((s) => s === statusParam);
  const q = param(sp, 'q') ?? '';
  const page = param(sp, 'page') ? Number(param(sp, 'page')) : 1;

  const filters: AdminJobFilters = { status, q: q || undefined, page };
  const { jobs, total, pageSize } = await getAdminJobs(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Empleos</h1>
          <p className="text-sm text-ink-secondary mt-1">{total} empleo(s)</p>
        </div>
        <Link
          href="/admin/empleos/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
        >
          + Nuevo empleo
        </Link>
      </div>

      <EmpleosFilterBar status={statusParam ?? ''} q={q} />

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Categoría / Ciudad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Postulantes</th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary">
                  No se encontraron empleos con esos filtros.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/empleos/${job.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{job.company}</td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {job.category} · {job.city}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {job.applicantCount > 0 ? (
                      <Link
                        href={`/admin/postulaciones?job=${job.id}`}
                        className="hover:text-brand font-medium"
                      >
                        {job.applicantCount}
                      </Link>
                    ) : (
                      <span className="text-ink-3">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {new Date(job.createdAt).toLocaleDateString('es-PY')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams();
            if (statusParam) params.set('status', statusParam);
            if (q) params.set('q', q);
            params.set('page', String(p));
            return (
              <Link
                key={p}
                href={`/admin/empleos?${params.toString()}`}
                className={`w-9 h-9 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-brand text-white'
                    : 'bg-white border border-border text-ink-secondary hover:border-brand'
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
