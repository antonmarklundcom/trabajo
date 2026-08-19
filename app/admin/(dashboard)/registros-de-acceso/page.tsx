// /admin/registros-de-acceso — data_access_logs, read-only (PLAN-PHASE2.md §5.2).
//
// The owner's view of their own team's access to candidate data, including
// their own. Read-only in the strongest sense available: there is no handler
// anywhere in this repo that updates or deletes a row of this table, and the
// only thing that removes rows is the 24-month retention sweep (§4.3).
//
// The page shows ids, never candidate names — that would make the audit log
// itself a directory of candidates. Following a subject id to the profile is a
// link to /admin/postulantes/[id], which asks for its own reason and writes its
// own row.
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSessionWithRole } from '@/lib/auth';
import { listAccessLogs } from '@/lib/db/candidates-admin';
import { listAuthEvents } from '@/lib/db/auth-events';

export const metadata: Metadata = {
  title: 'Registros de acceso — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const AUTH_EVENT_LABEL: Record<string, string> = {
  login_ok: 'Ingreso',
  login_fail: 'Ingreso fallido',
  logout: 'Cierre de sesión',
  password_change: 'Cambio de contraseña',
  password_reset_request: 'Pidió restablecer',
  password_reset_ok: 'Restableció la contraseña',
};

const SURFACE_LABEL: Record<string, string> = {
  admin: 'Equipo',
  empresa: 'Empresa',
  postulante: 'Postulante',
};

const ACTION_LABEL: Record<string, string> = {
  list_candidates: 'Búsqueda de postulante',
  view_candidate: 'Vio el perfil',
  view_cv: 'Abrió el CV',
  view_application: 'Vio la postulación',
  export: 'Exportación',
};

export default async function RegistrosDeAccesoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Admin-only, like /admin/postulantes and for the same §2.4 reason: this is
  // oversight of the people who can read candidate data, and the curation team
  // is not one of them.
  const user = await requireSessionWithRole(['admin']);

  const pageParam = first((await searchParams).page) ?? '1';
  const page = /^[0-9]+$/.test(pageParam) ? Math.max(1, Number(pageParam)) : 1;

  const tab = first((await searchParams).tab) === 'auth' ? 'auth' : 'datos';

  const { rows, total, pageSize } = await listAccessLogs(user, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // The second table answers a different question from the first: not "who read
  // a candidate's data" but "who tried to get in" (PLAN-NEXT.md §2 A1). Read
  // only when its tab is open, so the default view costs the same query it
  // always did.
  const auth = tab === 'auth' ? await listAuthEvents(page) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Registros de acceso</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Cada vez que alguien del equipo abre el perfil o el CV de un postulante queda una fila
          acá — incluida la tuya. {total.toLocaleString('es-PY')} registro(s).
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E7E1D6]">
        <Link
          href="/admin/registros-de-acceso"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'datos'
              ? 'border-[#C0362A] text-[#1E1B17]'
              : 'border-transparent text-[#57514A] hover:text-[#1E1B17]'
          }`}
        >
          Acceso a datos
        </Link>
        <Link
          href="/admin/registros-de-acceso?tab=auth"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'auth'
              ? 'border-[#C0362A] text-[#1E1B17]'
              : 'border-transparent text-[#57514A] hover:text-[#1E1B17]'
          }`}
        >
          Ingresos y contraseñas
        </Link>
      </div>

      {auth ? (
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F1EA] text-left text-[#57514A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Superficie</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Quién</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E1D6]">
                {auth.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#57514A]">
                      Todavía no hay registros de ingreso.
                    </td>
                  </tr>
                ) : (
                  auth.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F5F1EA]">
                      <td className="px-4 py-3 text-[#57514A] whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString('es-PY')}
                      </td>
                      <td className="px-4 py-3 text-[#57514A]">
                        {SURFACE_LABEL[row.surface] ?? row.surface}
                      </td>
                      <td className="px-4 py-3 text-[#1E1B17]">
                        {AUTH_EVENT_LABEL[row.event] ?? row.event}
                      </td>
                      <td className="px-4 py-3 text-[#57514A]">
                        {/* An identity when there was one, a truncated hint when
                            the attempt failed — never the full address typed. */}
                        {row.actorName ??
                          (row.candidateId !== null
                            ? `Postulante #${row.candidateId}`
                            : row.userId !== null
                              ? `Usuario #${row.userId}`
                              : (row.identifierHint ?? '—'))}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8A8378]">{row.ip ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-sm text-[#57514A] border-t border-[#E7E1D6]">
            {auth.total.toLocaleString('es-PY')} registro(s). Sólo lectura, sin búsqueda ni
            exportación.
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F1EA] text-left text-[#57514A]">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Quién</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Postulante</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E1D6]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#57514A]">
                    Todavía nadie accedió a datos de postulantes.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F5F1EA]">
                    <td className="px-4 py-3 text-[#57514A] whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString('es-PY')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#1E1B17]">
                        {/* The user row can be gone; the log row is not. */}
                        {row.actorName ?? `Usuario #${row.actorUserId}`}
                      </div>
                      <div className="text-xs text-[#8A8378]">{row.actorRole}</div>
                    </td>
                    <td className="px-4 py-3 text-[#57514A]">
                      {ACTION_LABEL[row.action] ?? row.action}
                    </td>
                    <td className="px-4 py-3">
                      {row.subjectType === 'candidate' ? (
                        <Link
                          href={`/admin/postulantes/${row.subjectId}`}
                          className="text-[#1E1B17] hover:text-[#C0362A] font-medium"
                        >
                          #{row.subjectId}
                        </Link>
                      ) : (
                        <span className="text-[#57514A]">
                          {row.subjectType} #{row.subjectId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#57514A] max-w-xs">
                      {row.reason ?? <span className="text-[#8A8378]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8A8378]">{row.ip ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {auth !== null && auth.total > auth.pageSize && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: Math.ceil(auth.total / auth.pageSize) }, (_, i) => i + 1)
            .filter((p) => p === 1 || Math.abs(p - page) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={`/admin/registros-de-acceso?tab=auth&page=${p}`}
                className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-[#C0362A] text-white'
                    : 'text-[#57514A] border border-[#E7E1D6] hover:border-[#C0362A]'
                }`}
              >
                {p}
              </Link>
            ))}
        </div>
      )}

      {totalPages > 1 && auth === null && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={`/admin/registros-de-acceso?page=${p}`}
                className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-[#C0362A] text-white'
                    : 'text-[#57514A] border border-[#E7E1D6] hover:border-[#C0362A]'
                }`}
              >
                {p}
              </Link>
            ))}
        </div>
      )}

      <p className="text-xs text-[#8A8378]">
        Esta tabla es de solo lectura: no se puede editar ni borrar desde el panel. Las filas se
        conservan 24 meses y después las elimina <span className="font-mono">npm run db:purge</span>.
      </p>
    </div>
  );
}
