// /admin/postulantes/[id] — the drill-down, reason-gated (PLAN-PHASE2.md §5.2).
//
// The gate is the whole point of this file: with no valid `motivo` in the URL,
// this page fetches NOTHING. It does not check whether the id exists, it does
// not read a name to put in the heading, it renders a form. The data only
// exists in this component after viewCandidate() has returned — and that
// function writes the data_access_logs row before it returns, so there is no
// arrangement of this page that can show a profile without having logged it.
//
// The reason travels in the query string rather than in POST state so that the
// same link can carry it to the CV route (/api/admin/cv/[id]?motivo=…), which
// logs its own separate `view_cv` row. Two disclosures, two rows: a log that
// conflates "opened the profile" with "read the CV" answers neither question.
//
// A reload with the reason still in the URL writes another row. That is
// correct — it is another access — and it is why the log is a history rather
// than a set.
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { requireSessionWithRole } from '@/lib/auth';
import { getClientIp } from '@/lib/leads';
import {
  ACCESS_REASON_CODES,
  ACCESS_REASON_LABELS,
  resolveAccessReason,
  viewCandidate,
} from '@/lib/db/candidates-admin';

export const metadata: Metadata = {
  title: 'Postulante — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  reviewed: 'Revisada',
  contacted: 'Contactado',
  discarded: 'Descartada',
  hired: 'Contratado',
};

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * The gate. Rendered whenever there is no usable reason — including when the
 * operator picked "otro" and left the detail empty, which is the absence of a
 * reason wearing a label.
 */
function ReasonGate({ candidateId, invalid }: { candidateId: number; invalid: boolean }) {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/postulantes" className="text-sm text-[#57514A] hover:text-[#C0362A]">
          ← Postulantes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1E1B17]">Postulante #{candidateId}</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Para ver los datos de un postulante tenés que indicar el motivo. El acceso queda
          registrado con tu nombre, la fecha y el motivo, y el postulante puede pedir ese registro.
        </p>
      </div>

      <form method="GET" className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 space-y-4">
        {invalid && (
          <p className="text-sm text-[#B42318]">
            Elegí un motivo de la lista. Si elegís &ldquo;Otro&rdquo;, escribí cuál.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[#1E1B17] mb-2">Motivo del acceso</legend>
          {ACCESS_REASON_CODES.map((code, index) => (
            <label key={code} className="flex items-center gap-2 text-sm text-[#57514A]">
              <input
                type="radio"
                name="motivo"
                value={code}
                defaultChecked={index === 0}
                className="accent-[#C0362A]"
              />
              {ACCESS_REASON_LABELS[code]}
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="detalle" className="block text-sm font-medium text-[#1E1B17] mb-1">
            Detalle <span className="text-[#8A8378] font-normal">(obligatorio si elegís Otro)</span>
          </label>
          <input
            id="detalle"
            name="detalle"
            type="text"
            maxLength={200}
            className="w-full rounded-[10px] border border-[#E7E1D6] px-3 py-2 text-sm focus:border-[#C0362A] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-[10px] text-sm font-medium text-white bg-[#C0362A] hover:bg-[#A32C22] transition-colors"
        >
          Ver datos y registrar el acceso
        </button>
      </form>
    </div>
  );
}

export default async function PostulanteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Exactly `admin` (PLAN-PHASE2.md §2.4); re-checked inside viewCandidate().
  const user = await requireSessionWithRole(['admin']);

  const idParam = (await params).id;
  if (!/^[0-9]+$/.test(idParam)) notFound();
  const candidateId = Number(idParam);

  const sp = await searchParams;
  const motivo = first(sp.motivo);
  const detalle = first(sp.detalle);
  const reason = resolveAccessReason(motivo, detalle);

  // No reason, no read. Nothing below this line runs until there is one.
  if (!reason) {
    return <ReasonGate candidateId={candidateId} invalid={Boolean(motivo)} />;
  }

  const ip = getClientIp(await headers());
  const profile = await viewCandidate(user, candidateId, reason, {
    ip: ip === 'unknown' ? null : ip,
  });
  if (!profile) notFound();

  // Carried onto the CV links so the second, separately logged action inherits
  // the same stated reason instead of asking for it again.
  const motivoQuery = `motivo=${encodeURIComponent(reason)}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/postulantes" className="text-sm text-[#57514A] hover:text-[#C0362A]">
          ← Postulantes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1E1B17]">Postulante #{profile.id}</h1>
      </div>

      <div className="rounded-[10px] border border-[#F3C9C4] bg-[#FBECE9] px-4 py-3">
        <p className="text-sm text-[#96190F]">
          Este acceso quedó registrado a tu nombre. Motivo: <strong>{reason}</strong>.
        </p>
      </div>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17] mb-4">Datos personales</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-[#8A8378]">Nombre</dt>
            <dd className="text-[#1E1B17] font-medium">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Email</dt>
            <dd className="text-[#57514A]">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Teléfono</dt>
            <dd className="text-[#57514A]">{profile.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Ciudad</dt>
            <dd className="text-[#57514A]">{profile.cityName ?? 'Sin ciudad'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Titular</dt>
            <dd className="text-[#57514A]">{profile.headline ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Estado</dt>
            <dd className="text-[#57514A]">{profile.isActive ? 'Activa' : 'Inactiva'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Registro</dt>
            <dd className="text-[#57514A]">
              {new Date(profile.createdAt).toLocaleDateString('es-PY')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#8A8378]">Último ingreso</dt>
            <dd className="text-[#57514A]">
              {profile.lastLoginAt
                ? new Date(profile.lastLoginAt).toLocaleDateString('es-PY')
                : 'Nunca'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17] mb-1">CVs</h2>
        <p className="text-xs text-[#8A8378] mb-4">
          Abrir un CV es un acceso aparte y se registra por separado.
        </p>
        {profile.cvs.length === 0 ? (
          <p className="text-sm text-[#57514A]">No subió ningún CV.</p>
        ) : (
          <ul className="divide-y divide-[#E7E1D6] border-t border-[#E7E1D6]">
            {profile.cvs.map((cv) => (
              <li key={cv.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-[#1E1B17] truncate">{cv.originalFilename}</p>
                  <p className="text-xs text-[#8A8378]">
                    {formatBytes(cv.sizeBytes)} ·{' '}
                    {new Date(cv.uploadedAt).toLocaleDateString('es-PY')}
                    {cv.isCurrent ? ' · actual' : ''}
                  </p>
                </div>
                <a
                  href={`/api/admin/cv/${cv.id}?${motivoQuery}`}
                  className="flex-shrink-0 text-sm font-medium text-[#C0362A] hover:underline"
                >
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17] mb-4">Experiencia laboral</h2>
        {profile.experiences.length === 0 ? (
          <p className="text-sm text-[#57514A]">Sin experiencia cargada.</p>
        ) : (
          <ul className="space-y-3">
            {profile.experiences.map((exp) => (
              <li key={exp.id} className="text-sm">
                <p className="font-medium text-[#1E1B17]">{exp.title}</p>
                <p className="text-[#57514A]">{exp.companyName}</p>
                <p className="text-xs text-[#8A8378]">
                  {exp.startMonth.slice(0, 7)} —{' '}
                  {exp.isCurrent ? 'actual' : (exp.endMonth?.slice(0, 7) ?? '—')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17] mb-4">
          Postulaciones ({profile.applications.length})
        </h2>
        {profile.applications.length === 0 ? (
          <p className="text-sm text-[#57514A]">Todavía no se postuló a ningún empleo.</p>
        ) : (
          <ul className="divide-y divide-[#E7E1D6] border-t border-[#E7E1D6]">
            {profile.applications.map((app) => (
              <li key={app.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="text-[#1E1B17] truncate">{app.jobTitle}</p>
                  <p className="text-[#57514A]">{app.companyName}</p>
                  {app.redactedAt && (
                    <p className="text-xs text-[#8A8378] italic">
                      Datos retirados el {new Date(app.redactedAt).toLocaleDateString('es-PY')}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[#57514A]">{STATUS_LABEL[app.status] ?? app.status}</p>
                  <p className="text-xs text-[#8A8378]">
                    {new Date(app.createdAt).toLocaleDateString('es-PY')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
