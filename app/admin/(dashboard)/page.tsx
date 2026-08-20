import type { Metadata } from 'next';
import Link from 'next/link';
import { getDashboardStats } from '@/lib/db/admin';
import { daysSince, getLastPurgeRun, PURGE_STALE_AFTER_DAYS } from '@/lib/db/ops-state';

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
  const [stats, lastPurgeRun] = await Promise.all([getDashboardStats(), getLastPurgeRun()]);

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
        />
        <StatCard
          label="Empleos publicados"
          value={stats.publishedCount}
          href="/admin/empleos?status=published"
        />
        <StatCard label="Empresas" value={stats.companyCount} href="/admin/empresas" />
      </div>

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
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
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
    </Link>
  );
}
