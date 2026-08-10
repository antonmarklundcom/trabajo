// /admin/retencion — what the next retention sweep would delete (§4.3).
//
// Read-only, and read-only in the strongest sense available: this route renders
// the output of pure SELECTs and there is no mutating handler anywhere behind
// it. Deleting is `npm run db:purge -- --apply` on the server (DEPLOY.md), on
// purpose — a "purge now" button in a browser is a data-destruction path
// reachable by a session cookie.
//
// It shows COUNTS AND DATES ONLY. No candidate name, email, phone or id
// appears here, and no row links to /admin/postulantes/[id]. That is what keeps
// this page out of the reason-gated, logged path in lib/db/candidates-admin.ts
// (AGENTS.md): with no data subject on the page there is nothing to log access
// against. Adding a "who exactly" column would change that, and would need the
// logged path — not a wider query here.
//
// Admin-only, matching /admin/postulantes rather than the admin/editor parity of
// the rest of the dashboard: the sweep's backlog is a fact about candidates.
import type { Metadata } from 'next';

import { requireSessionWithRole } from '@/lib/auth';
import { getRetentionSummary, type RetentionBucket } from '@/lib/db/retention-summary';

export const metadata: Metadata = {
  title: 'Retención de datos — trabajo.com.py',
  robots: { index: false, follow: false },
};

function fmtDate(date: Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtDateTime(date: Date): string {
  return new Date(date).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BucketCard({
  title,
  bucket,
  action,
  trigger,
  oldestLabel,
  note,
}: {
  title: string;
  bucket: RetentionBucket;
  action: string;
  trigger: string;
  oldestLabel: string;
  note?: string;
}) {
  return (
    <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-[#1E1B17]">{title}</h2>
        <span className="text-xs text-[#8A8378] whitespace-nowrap">{bucket.months} meses</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-[#1E1B17]">
        {bucket.count.toLocaleString('es-PY')}
      </p>
      <p className="mt-1 text-xs text-[#8A8378]">{action}</p>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#57514A]">{oldestLabel}</dt>
          <dd className="font-medium text-[#1E1B17]">{fmtDate(bucket.oldest)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#57514A]">Corte</dt>
          <dd className="font-medium text-[#1E1B17]">{fmtDate(bucket.cutoff)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[#57514A]">{trigger}</p>
      {note && <p className="mt-2 text-xs text-[#C0362A]">{note}</p>}
    </div>
  );
}

export default async function RetencionPage() {
  // The layout already gates on ['admin','editor']; this narrows to admin.
  // Hiding the nav link is UX, this is the check (AGENTS.md).
  await requireSessionWithRole(['admin']);

  const summary = await getRetentionSummary();
  const totalDue =
    summary.candidates.count +
    summary.applications.count +
    summary.consents.count +
    summary.accessLogs.count;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Retención de datos</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Lo que borraría la próxima limpieza de retención. Solo cantidades y fechas: esta página no
          muestra nombres, correos ni identificadores de postulantes, y por eso no queda registrada
          en <span className="font-medium">Registros de acceso</span>.
        </p>
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <p className="text-sm text-[#1E1B17]">
          {totalDue === 0 ? (
            <>
              No hay nada pendiente de borrar en este momento. Los{' '}
              {summary.warnings.count.toLocaleString('es-PY')} postulantes en ventana de aviso
              todavía no cumplen el plazo.
            </>
          ) : (
            <>
              La próxima limpieza afectaría{' '}
              <span className="font-bold">{totalDue.toLocaleString('es-PY')}</span> registros en
              total.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-[#8A8378]">
          Calculado el {fmtDateTime(summary.computedAt)}. Los datos se actualizan cada 5 minutos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BucketCard
          title="Perfiles y CVs de postulantes"
          bucket={summary.candidates}
          action="cuentas que se borrarían por completo, junto con su CV"
          oldestLabel="Actividad más antigua"
          trigger="Se cuentan desde el último ingreso; si nunca ingresó, desde la creación de la cuenta."
        />
        <BucketCard
          title="Postulantes en ventana de aviso"
          bucket={summary.warnings}
          action="cuentas que deberían recibir un aviso previo"
          oldestLabel="Actividad más antigua"
          trigger="Ya pasaron los 23 meses pero todavía no los 24."
          note="Solo informativo: todavía no hay proveedor de correo, así que no se envía ningún aviso."
        />
        <BucketCard
          title="Datos personales de postulaciones"
          bucket={summary.applications}
          action="postulaciones a las que se les borrarían los datos personales"
          oldestLabel="Cierre más antiguo"
          trigger="Se cuentan desde que el empleo venció o fue archivado. La postulación no se elimina: se vacían nombre, teléfono, correo, mensaje y CV."
        />
        <BucketCard
          title="Consentimientos"
          bucket={summary.consents}
          action="registros de consentimiento que se eliminarían"
          oldestLabel="Purga más antigua"
          trigger="Se cuentan desde que se purgaron los datos que autorizaban, no desde que se otorgaron. Nunca se eliminan los de un postulante que sigue existiendo."
        />
        <BucketCard
          title="Registros de acceso"
          bucket={summary.accessLogs}
          action="registros de acceso que se eliminarían"
          oldestLabel="Acceso más antiguo"
          trigger="Se cuentan desde la fecha del acceso."
        />
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-sm font-semibold text-[#1E1B17]">Cómo se ejecuta</h2>
        <p className="mt-2 text-sm text-[#57514A]">
          La limpieza no es automática: no hay cron en el servidor. Alguien la ejecuta manualmente,
          una vez por mes, desde el servidor:
        </p>
        <div className="mt-3 space-y-2 font-mono text-xs">
          <p className="rounded-[8px] bg-[#F5F1EA] px-3 py-2 text-[#1E1B17]">npm run db:purge</p>
          <p className="text-[#57514A]">
            Simulación: lee, imprime todo lo que tocaría y no cambia nada. Es el modo por defecto.
          </p>
          <p className="rounded-[8px] bg-[#F5F1EA] px-3 py-2 text-[#1E1B17]">
            npm run db:purge -- --apply
          </p>
          <p className="text-[#57514A]">Ejecuta el borrado listado por la simulación.</p>
        </div>
        <p className="mt-3 text-sm text-[#57514A]">
          Leé siempre la simulación antes de usar <span className="font-mono text-xs">--apply</span>
          : las dos ejecuciones usan las mismas consultas y los mismos cortes que esta página. El
          procedimiento completo, incluidos los casos de error, está en{' '}
          <span className="font-medium">DEPLOY.md</span>, sección{' '}
          <span className="font-mono text-xs">npm run db:purge</span>.
        </p>
        <p className="mt-2 text-xs text-[#8A8378]">
          Los plazos ({summary.candidates.months} / {summary.applications.months} /{' '}
          {summary.consents.months} / {summary.accessLogs.months} meses) se leen de{' '}
          <span className="font-mono">lib/retention.ts</span>, el mismo archivo que usa el script.{' '}
          <span className="font-mono">deletion_requests</span> se conserva de forma indefinida y
          nunca se borra.
        </p>
      </div>
    </div>
  );
}
