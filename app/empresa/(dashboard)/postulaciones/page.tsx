import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCompanyScope } from '@/lib/auth';
import {
  listEmployerApplications,
  listEmployerJobOptions,
  type EmployerApplicationFilters,
} from '@/lib/db/employer';
import { applicationStatusEnum } from '@/lib/db/schema';
import PostulacionesFilterBar from '@/components/empresa/PostulacionesFilterBar';
import ApplicationStatusSelect from '@/components/empresa/ApplicationStatusSelect';

export const metadata: Metadata = {
  title: 'Postulaciones — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function EmpresaPostulacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { companyId } = await requireCompanyScope();

  const sp = await searchParams;
  const statusParam = param(sp, 'status');
  const status = applicationStatusEnum.find((s) => s === statusParam);
  const jobIdParam = param(sp, 'job');
  const jobId = jobIdParam ? Number(jobIdParam) : undefined;
  const page = param(sp, 'page') ? Number(param(sp, 'page')) : 1;

  const filters: EmployerApplicationFilters = { status, jobId, page };
  const [{ applications, total, pageSize }, jobOptions] = await Promise.all([
    listEmployerApplications(companyId, filters),
    listEmployerJobOptions(companyId),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E1B17]">Postulaciones</h1>
        <p className="text-sm text-[#57514A] mt-1">{total} postulación(es) a tus empleos.</p>
      </div>

      <PostulacionesFilterBar
        status={statusParam ?? ''}
        jobId={jobIdParam ?? ''}
        jobs={jobOptions}
      />

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E1D6] text-left text-xs uppercase tracking-wider text-[#57514A]">
              <th className="px-4 py-3 font-medium">Postulante</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Empleo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E1D6]">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#57514A]">
                  Todavía no recibiste postulaciones con esos filtros.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app.id} className="hover:bg-[#F5F1EA]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E1B17]">{app.name}</div>
                    {app.message && (
                      <div className="text-xs text-[#8A8378] mt-0.5 max-w-xs truncate">{app.message}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#57514A]">
                    <div>{app.phone}</div>
                    {app.email && <div className="text-xs text-[#8A8378]">{app.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/empresa/empleos?job=${app.jobId}`}
                      className="text-[#1E1B17] hover:text-[#C0362A] font-medium"
                    >
                      {app.jobTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationStatusSelect id={app.id} status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-[#8A8378]">
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
                href={`/empresa/postulaciones?${params.toString()}`}
                className={`w-9 h-9 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-[#C0362A] text-white'
                    : 'bg-white border border-[#E7E1D6] text-[#57514A] hover:border-[#C0362A]'
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
