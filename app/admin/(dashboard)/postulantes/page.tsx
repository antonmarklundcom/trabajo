// /admin/postulantes — aggregate by default (PLAN-PHASE2.md §5.2).
//
// This is the page the plan flags as the highest-risk piece of the whole
// feature, so the shape is deliberate: what you get without asking for anything
// is a set of counts. There is no list of candidates on this page, because a
// list of candidates IS the talent database we told the regulator we do not
// operate.
//
// Reaching one person takes an exact email or an exact id — you have to already
// know who you are looking for — and reaching their data takes a reason, on the
// next page, which is written to data_access_logs before it renders.
//
// Three things are absent on purpose and must stay absent: free-text search, a
// "ver todos" listing, and any export button.
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';

import { requireSessionWithRole } from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';
import { listCandidates, type LabeledCount } from '@/lib/db/candidates-admin';

export const metadata: Metadata = {
  title: 'Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const VOLUME_LABELS: Record<string, string> = {
  '0': 'Sin postulaciones',
  '1': '1 postulación',
  '2-5': '2 a 5 postulaciones',
  '6+': '6 o más postulaciones',
};

function CountList({
  title,
  items,
  labelMap,
  empty,
}: {
  title: string;
  items: LabeledCount[];
  labelMap?: Record<string, string>;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
      <h2 className="text-sm font-semibold text-[#1E1B17] mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[#57514A]">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <span className="w-40 flex-shrink-0 truncate text-[#57514A]">
                {labelMap?.[item.label] ?? item.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-[#F5F1EA] overflow-hidden">
                <div
                  className="h-full bg-[#C0362A] rounded-full"
                  style={{ width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }}
                />
              </div>
              <span className="w-12 flex-shrink-0 text-right font-medium text-[#1E1B17]">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PostulantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Exactly `admin`, not `editor` (PLAN-PHASE2.md §2.4). The (dashboard) layout
  // above admits both roles, so this narrowing has to be stated here — and it
  // is stated again inside every candidates-admin.ts function, which is the one
  // that actually protects the data.
  const user = await requireSessionWithRole(['admin']);

  const sp = await searchParams;
  const email = first(sp.email)?.trim() ?? '';
  const idParam = first(sp.id)?.trim() ?? '';
  const candidateId = /^[0-9]+$/.test(idParam) ? Number(idParam) : null;

  const { aggregates, lookupAttempted, match } = await listCandidates(
    user,
    { email: email || null, candidateId },
    null,
    { ip: clientIp(await headers()) },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Postulantes</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Vista agregada. Para abrir un perfil necesitás el email exacto o el id, y tenés que
          indicar el motivo del acceso — que queda registrado.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-4">
          <p className="text-xs uppercase tracking-wider text-[#8A8378]">Postulantes</p>
          <p className="mt-1 text-2xl font-bold text-[#1E1B17]">
            {aggregates.total.toLocaleString('es-PY')}
          </p>
        </div>
      </div>

      {/* --- Lookup: exact email or exact id, never a search ---------------- */}
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17]">Buscar un postulante puntual</h2>
        <p className="text-xs text-[#8A8378] mt-1">
          Solo por email exacto o por id. No hay búsqueda por nombre, por CV ni por experiencia
          laboral: para abrir un perfil hay que saber de antemano a quién se busca.
        </p>
        <form method="GET" className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            name="email"
            defaultValue={email}
            placeholder="email exacto"
            className="flex-1 rounded-[10px] border border-[#E7E1D6] px-3 py-2 text-sm focus:border-[#C0362A] focus:outline-none"
          />
          <input
            type="text"
            inputMode="numeric"
            name="id"
            defaultValue={idParam}
            placeholder="id"
            className="w-full sm:w-32 rounded-[10px] border border-[#E7E1D6] px-3 py-2 text-sm focus:border-[#C0362A] focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-[10px] text-sm font-medium text-white bg-[#C0362A] hover:bg-[#A32C22] transition-colors"
          >
            Buscar
          </button>
        </form>

        {lookupAttempted && (
          <div className="mt-4 border-t border-[#E7E1D6] pt-4">
            {match ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs text-[#8A8378]">Id</dt>
                    <dd className="font-medium text-[#1E1B17]">{match.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#8A8378]">Ciudad</dt>
                    <dd className="text-[#57514A]">{match.cityName ?? 'Sin ciudad'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#8A8378]">Registro</dt>
                    <dd className="text-[#57514A]">
                      {new Date(match.createdAt).toLocaleDateString('es-PY')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#8A8378]">Postulaciones</dt>
                    <dd className="text-[#57514A]">{match.applicationCount}</dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/postulantes/${match.id}`}
                  className="px-4 py-2 rounded-[10px] text-sm font-medium text-[#1E1B17] border border-[#E7E1D6] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
                >
                  Abrir perfil
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[#57514A]">
                No hay ningún postulante con ese email o ese id.
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- The aggregate view -------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CountList
          title="Por ciudad"
          items={aggregates.byCity}
          empty="Todavía no hay postulantes registrados."
        />
        <CountList
          title="Por volumen de postulaciones"
          items={aggregates.byApplicationVolume}
          labelMap={VOLUME_LABELS}
          empty="Todavía no hay postulantes registrados."
        />
      </div>

      <CountList
        title="Por mes de registro (últimos 12 meses con datos)"
        items={aggregates.bySignupMonth}
        empty="Todavía no hay postulantes registrados."
      />

      <p className="text-xs text-[#8A8378]">
        No existe exportación masiva de postulantes, ni acá ni en ninguna otra pantalla. Si un
        postulante pide sus datos, los descarga él mismo desde{' '}
        <span className="font-mono">/postulante/mis-datos</span>.
      </p>
    </div>
  );
}
