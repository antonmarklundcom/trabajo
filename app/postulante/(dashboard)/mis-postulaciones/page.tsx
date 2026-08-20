import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCandidate } from '@/lib/auth-candidate';
import { listCandidateApplications } from '@/lib/db/candidate-applications';
import WithdrawButton from '@/components/postulante/WithdrawButton';

export const metadata: Metadata = {
  title: 'Mis postulaciones — trabajo.com.py',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  reviewed: 'Revisada',
  contacted: 'Contactado',
  discarded: 'Descartada',
  hired: 'Contratado',
};

export default async function MisPostulacionesPage() {
  const candidate = await requireCandidate();
  const applications = await listCandidateApplications(candidate.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Mis postulaciones</h1>
        <p className="text-sm text-ink-secondary mt-1">{applications.length} postulación(es).</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-[10px] border border-border p-8 text-center">
          <p className="text-sm text-ink-secondary">Todavía no te postulaste a ningún empleo.</p>
          <Link href="/empleos" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Ver empleos disponibles
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => (
            <li key={app.id} className="bg-white rounded-[10px] border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/empleos/${app.jobSlug}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {app.jobTitle}
                  </Link>
                  <p className="text-sm text-ink-secondary">{app.companyName}</p>
                  <p className="text-xs text-ink-3 mt-1">
                    {new Date(app.createdAt).toLocaleDateString('es-PY')}
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-ink-secondary whitespace-nowrap">
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>

              {app.redactedAt ? (
                <p className="mt-3 text-xs text-ink-3 italic">
                  Retiraste tu consentimiento para esta postulación el{' '}
                  {new Date(app.redactedAt).toLocaleDateString('es-PY')}.
                </p>
              ) : (
                <div className="mt-3">
                  <WithdrawButton applicationId={app.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
