import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCompanyScope } from '@/lib/auth';
import { listEmployerJobs, type EmployerJobFilters } from '@/lib/db/employer';
import { jobStatusEnum } from '@/lib/db/schema';
import StatusBadge from '@/components/admin/StatusBadge';
import WhatsAppCta from '@/components/WhatsAppCta';
import { daysUntil, listingExpiryState } from '@/lib/listing-expiry';
import { getEmployerCompany } from '@/lib/db/employer';

export const metadata: Metadata = {
  title: 'Empleos — Empresas',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function EmpresaEmpleosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { companyId } = await requireCompanyScope();

  const sp = await searchParams;
  const statusParam = param(sp, 'status');
  const status = jobStatusEnum.find((s) => s === statusParam);
  const q = param(sp, 'q') ?? '';
  const page = param(sp, 'page') ? Number(param(sp, 'page')) : 1;

  const filters: EmployerJobFilters = { status, q: q || undefined, page };
  const [{ jobs, total, pageSize }, company] = await Promise.all([
    listEmployerJobs(companyId, filters),
    getEmployerCompany(companyId),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Empleos</h1>
          <p className="text-sm text-ink-secondary mt-1">{total} empleo(s) publicados por tu empresa.</p>
        </div>
        <Link
          href="/empresa/empleos/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          + Nuevo empleo
        </Link>
      </div>

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Categoría / Ciudad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Postulantes</th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-secondary">
                  Todavía no publicaste ningún empleo.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/empresa/empleos/${job.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {job.title}
                    </Link>
                    {job.status === 'rejected' && job.rejectionReason && (
                      <div className="text-xs text-error mt-0.5 max-w-xs">
                        {job.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {job.category} · {job.city}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                    {job.status === 'published' && <ExpiryNote expiresAt={job.expiresAt} />}
                    {job.status === 'published' &&
                      ['expiring', 'expired'].includes(listingExpiryState(job.expiresAt)) && (
                        <div className="mt-1.5">
                          <WhatsAppCta
                            intent="renovar_aviso"
                            variant="link"
                            size="sm"
                            label="Renovar por WhatsApp"
                            context={{ jobTitle: job.title, companyName: company?.name }}
                            sourcePage="/empresa/empleos"
                          />
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {job.applicantCount > 0 ? (
                      <Link
                        href={`/empresa/postulaciones?job=${job.id}`}
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
                href={`/empresa/empleos?${params.toString()}`}
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

/**
 * "Vence el …" under a published listing's status (lib/listing-expiry.ts). An
 * expired listing is still `published` in the database — time took it down,
 * not a person — so the badge alone would say "Publicado" over a listing
 * nobody can see.
 */
function ExpiryNote({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) return null;
  const state = listingExpiryState(expiresAt);
  const date = new Date(expiresAt).toLocaleDateString('es-PY');
  if (state === 'expired') {
    return <div className="text-xs text-error mt-1">Vencido el {date} — ya no se muestra</div>;
  }
  const days = daysUntil(expiresAt);
  return (
    <div className={`text-xs mt-1 ${state === 'expiring' ? 'text-gold-strong' : 'text-ink-3'}`}>
      Vence el {date}
      {state === 'expiring' && ` (en ${days} día${days === 1 ? '' : 's'})`}
    </div>
  );
}
