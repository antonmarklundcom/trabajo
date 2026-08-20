import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminApplications, listJobOptionsWithApplications, type AdminApplicationFilters } from '@/lib/db/admin';
import { applicationStatusEnum } from '@/lib/db/schema';
import PostulacionesFilterBar from '@/components/admin/PostulacionesFilterBar';
import ApplicationStatusSelect from '@/components/admin/ApplicationStatusSelect';

export const metadata: Metadata = { title: 'Postulaciones — trabajo.com.py' };

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function AdminPostulacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusParam = param(sp, 'status');
  const status = applicationStatusEnum.find((s) => s === statusParam);
  const jobIdParam = param(sp, 'job');
  const jobId = jobIdParam ? Number(jobIdParam) : undefined;
  const page = param(sp, 'page') ? Number(param(sp, 'page')) : 1;

  const filters: AdminApplicationFilters = { status, jobId, page };
  const [{ applications, total, pageSize }, jobOptions] = await Promise.all([
    getAdminApplications(filters),
    listJobOptionsWithApplications(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Postulaciones</h1>
        <p className="text-sm text-ink-secondary mt-1">{total} postulación(es)</p>
      </div>

      <PostulacionesFilterBar
        status={statusParam ?? ''}
        jobId={jobIdParam ?? ''}
        jobs={jobOptions}
      />

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Postulante</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Empleo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-secondary">
                  No se encontraron postulaciones con esos filtros.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    {app.redactedAt ? (
                      <div className="text-ink-3 italic">Datos eliminados</div>
                    ) : (
                      <>
                        <div className="font-medium text-ink">{app.name}</div>
                        {app.message && (
                          <div className="text-xs text-ink-3 mt-0.5 max-w-xs truncate">{app.message}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {app.redactedAt ? (
                      <div className="text-xs text-ink-3">
                        {new Date(app.redactedAt).toLocaleDateString('es-PY')}
                      </div>
                    ) : (
                      <>
                        <div>{app.phone}</div>
                        {app.email && <div className="text-xs text-ink-3">{app.email}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/empleos/${app.jobId}`}
                      className="text-ink hover:text-brand font-medium"
                    >
                      {app.jobTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationStatusSelect id={app.id} status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {new Date(app.createdAt).toLocaleDateString('es-PY')}
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
            if (jobIdParam) params.set('job', jobIdParam);
            params.set('page', String(p));
            return (
              <Link
                key={p}
                href={`/admin/postulaciones?${params.toString()}`}
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
