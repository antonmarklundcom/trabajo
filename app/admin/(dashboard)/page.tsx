import type { Metadata } from 'next';
import Link from 'next/link';
import { getDashboardStats, getRenewalQueue, type RenewalQueueRow } from '@/lib/db/admin';
import { getOpsConfig } from '@/lib/ops-config';
import { daysUntil } from '@/lib/listing-expiry';
import { teamToEmployerHref, type TeamToEmployerMessage } from '@/lib/whatsapp';
import { daysSince, getLastPurgeRun, PURGE_STALE_AFTER_DAYS } from '@/lib/db/ops-state';
import { formatLastSubmission } from '@/lib/formatters';
import { getLaunchPromoStatus } from '@/lib/promo';
import { LAUNCH_PROMO } from '@/lib/featured';

export const metadata: Metadata = { title: 'Panel — trabajo.com.py' };

const ACTION_LABELS: Record<string, string> = {
  create: 'creó',
  update: 'actualizó',
  delete: 'eliminó',
  approve: 'aprobó',
  publish: 'publicó',
  reject: 'rechazó',
  archive: 'archivó',
  feature: 'destacó',
  renew: 'renovó',
  feature_grant: 'aplicó un Destacado a',
  feature_revoke: 'quitó el Destacado de',
  self_serve_signup: 'se registró con',
  // Written by lib/db/employer.ts — an employer acting on their own company's
  // data shows up in the same feed the curation team already reads.
  employer_create: 'creó (empleador)',
  employer_update: 'actualizó (empleador)',
  status_change: 'cambió el estado de',
  invite_employer: 'invitó a un usuario para',
};

const ENTITY_LABELS: Record<string, string> = {
  job: 'el empleo',
  company: 'la empresa',
  user: 'el usuario',
  application: 'la postulación',
};

export default async function AdminDashboardPage() {
  const [stats, lastPurgeRun, promo, renewals] = await Promise.all([
    getDashboardStats(),
    getLastPurgeRun(),
    getLaunchPromoStatus(),
    getRenewalQueue(),
  ]);
  const opsConfig = getOpsConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Panel</h1>
        <p className="text-sm text-ink-secondary mt-1">Resumen de la actividad del sitio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Empleos pendientes"
          value={stats.pendingCount}
          href="/admin/empleos?status=pending"
          highlight={stats.pendingCount > 0}
          footer={`Último pedido de publicación: ${formatLastSubmission(stats.lastPublicSubmissionAt)}`}
        />
        <StatCard
          label="Empleos publicados"
          value={stats.publishedCount}
          href="/admin/empleos?status=published"
        />
        <StatCard label="Empresas" value={stats.companyCount} href="/admin/empresas" />
      </div>

      {/*
        The promotion quota (PLAN-GROWTH.md §8): the owner reads this weekly and
        sets LAUNCH_PROMO_ENABLED=false once it reaches 100. Rendered only while
        the flag is on — a counter for a promotion nobody is running is noise.
        The public copy disappears on its own at 0 remaining; the flag is what
        stops further grants.
      */}
      {promo.enabled && (
        <div className="rounded-[10px] border border-border bg-white p-5">
          <p className="text-sm text-ink-secondary">Promoción de lanzamiento</p>
          <p className="text-base font-semibold text-ink mt-1">
            Promoción: {promo.granted}/{promo.quota}
          </p>
          <p className="text-sm text-ink-secondary mt-1">
            {promo.remaining > 0
              ? `Quedan ${promo.remaining} avisos con Destacado de ${LAUNCH_PROMO.days} días gratis. Se aplica al aprobar cada aviso.`
              : 'El cupo está agotado. Poné LAUNCH_PROMO_ENABLED=false en hPanel para cerrar la promoción.'}
          </p>
        </div>
      )}

      <RenewalQueue
        title="Avisos que vencen"
        empty="Ningún aviso vence en los próximos días."
        rows={renewals.listings}
        kind="listing_renewal"
      />
      <RenewalQueue
        title="Destacados que vencen"
        empty="Ningún Destacado vence en los próximos días."
        rows={renewals.destacados}
        kind="featured_renewal"
      />

      <OpsConfigCard config={opsConfig} />

      <PurgeStatus lastRun={lastPurgeRun} />

      <div className="bg-white rounded-[10px] border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Actividad reciente</h2>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-secondary">
            Todavía no hay actividad registrada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentActivity.map((item) => (
              <li key={item.id} className="px-5 py-3 text-sm text-ink">
                <span className="font-medium">{item.actorName ?? 'Sistema'}</span>{' '}
                {ACTION_LABELS[item.action] ?? item.action}{' '}
                {ENTITY_LABELS[item.entityType] ?? item.entityType} #{item.entityId}
                <span className="text-ink-3">
                  {' · '}
                  {new Date(item.createdAt).toLocaleString('es-PY')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * "Última depuración" (PLAN-NEXT.md §3 O2).
 *
 * Hostinger has no cron, so `npm run db:purge -- --apply` is a monthly chore a
 * person does by hand — and until now a missed month looked exactly like a done
 * month. What gets missed is a deletion /privacidad promises, so the panel says
 * so out loud rather than waiting for someone to wonder.
 *
 * No external service and no cron dependency, per the brief: this reads one row
 * the script itself wrote.
 */
function PurgeStatus({ lastRun }: { lastRun: Date | null }) {
  const days = daysSince(lastRun);
  const overdue = days === null || days > PURGE_STALE_AFTER_DAYS;

  return (
    <div
      className={`rounded-[10px] border p-5 ${
        overdue ? 'border-brand bg-brand-tint' : 'border-border bg-white'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-secondary">Última depuración de datos</p>
        {overdue && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand text-white">
            Pendiente
          </span>
        )}
      </div>
      <p className={`text-base font-semibold mt-1 ${overdue ? 'text-brand' : 'text-ink'}`}>
        {lastRun === null
          ? 'Nunca se ejecutó'
          : `${lastRun.toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })} (hace ${days} día${days === 1 ? '' : 's'})`}
      </p>
      {overdue && (
        <p className="text-sm text-ink-secondary mt-1">
          La política de privacidad promete eliminar los datos inactivos. Ejecutá{' '}
          <code className="px-1 py-0.5 rounded bg-white border border-border text-xs">
            npm run db:purge -- --apply
          </code>{' '}
          desde tu máquina.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  highlight,
  footer,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
  footer?: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-[10px] border p-5 transition-colors ${
        highlight
          ? 'border-brand/30 bg-brand-tint hover:border-brand'
          : 'border-border bg-white hover:border-border-strong'
      }`}
    >
      <p className="text-sm text-ink-secondary">{label}</p>
      <p className="text-3xl font-bold text-ink mt-1">{value}</p>
      {footer && <p className="text-xs text-ink-3 mt-2">{footer}</p>}
    </Link>
  );
}

/**
 * "Vencen pronto" (lib/listing-expiry.ts). Hostinger has no cron, so a renewal
 * reminder is a list a person reads here, with the WhatsApp message to the
 * job's own contact number already written — the same one-tap shape as the
 * team's lead emails.
 */
function RenewalQueue({
  title,
  empty,
  rows,
  kind,
}: {
  title: string;
  empty: string;
  rows: RenewalQueueRow[];
  kind: TeamToEmployerMessage;
}) {
  return (
    <div className="bg-white rounded-[10px] border border-border">
      <div className="px-5 py-4 border-b border-border flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">{title}</h2>
        <span className="text-xs text-ink-3">Próximos 7 días y vencidos en los últimos 14</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-secondary">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const days = daysUntil(row.dueAt);
            const href = teamToEmployerHref(row.whatsapp, kind, { title: row.title });
            return (
              <li key={row.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <Link href={`/admin/empleos/${row.id}`} className="font-medium text-ink hover:text-brand">
                    {row.title}
                  </Link>
                  <span className="text-ink-3"> · {row.company}</span>
                  <div className={`text-xs mt-0.5 ${days <= 0 ? 'text-error' : 'text-ink-secondary'}`}>
                    {days <= 0
                      ? `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`
                      : `Vence en ${days} día${days === 1 ? '' : 's'}`}
                  </div>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-[10px] bg-wa hover:bg-wa-strong text-white text-xs font-semibold"
                  >
                    Escribir por WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-ink-3">Sin WhatsApp cargado</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * "Configuración" — which production settings are on (lib/ops-config.ts).
 * Every one of them degrades silently by design, so this is where "the site
 * works but nobody is told anything" becomes visible.
 */
function OpsConfigCard({ config }: { config: ReturnType<typeof getOpsConfig> }) {
  const off = config.items.filter((item) => !item.ok);
  return (
    <div
      className={`rounded-[10px] border p-5 ${
        config.contactLeadsLost ? 'border-brand bg-brand-tint' : 'border-border bg-white'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">Configuración</h2>
        <span className="text-xs text-ink-3">
          {off.length === 0 ? 'Todo activo' : `${off.length} sin activar`}
        </span>
      </div>
      {config.contactLeadsLost && (
        <p className="text-sm text-brand font-medium mt-2">
          Las consultas de /contacto no se guardan en ningún lado: configurá LEADS_NOTIFY_EMAIL
          (con Resend) o un webhook de leads.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {config.items.map((item) => (
          <li key={item.label} className="text-sm flex gap-2">
            <span
              aria-hidden="true"
              className={`mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${item.ok ? 'bg-success' : 'bg-error'}`}
            />
            <span>
              <span className="text-ink">{item.label}</span>
              <span className="sr-only">{item.ok ? ': activo' : ': sin activar'}</span>
              {!item.ok && <span className="block text-xs text-ink-secondary">{item.whenOff}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
