import type { Metadata } from 'next';
import Link from 'next/link';
import { getDashboardStats } from '@/lib/db/admin';

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
};

const ENTITY_LABELS: Record<string, string> = {
  job: 'el empleo',
  company: 'la empresa',
  user: 'el usuario',
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Panel</h1>
        <p className="text-sm text-[#57514A] mt-1">Resumen de la actividad del sitio.</p>
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

      <div className="bg-white rounded-[10px] border border-[#E7E1D6]">
        <div className="px-5 py-4 border-b border-[#E7E1D6]">
          <h2 className="font-semibold text-[#1E1B17]">Actividad reciente</h2>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#57514A]">
            Todavía no hay actividad registrada.
          </p>
        ) : (
          <ul className="divide-y divide-[#E7E1D6]">
            {stats.recentActivity.map((item) => (
              <li key={item.id} className="px-5 py-3 text-sm text-[#1E1B17]">
                <span className="font-medium">{item.actorName ?? 'Sistema'}</span>{' '}
                {ACTION_LABELS[item.action] ?? item.action}{' '}
                {ENTITY_LABELS[item.entityType] ?? item.entityType} #{item.entityId}
                <span className="text-[#8A8378]">
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
          ? 'border-[#C0362A]/30 bg-[#FBECE9] hover:border-[#C0362A]'
          : 'border-[#E7E1D6] bg-white hover:border-[#D8D0C2]'
      }`}
    >
      <p className="text-sm text-[#57514A]">{label}</p>
      <p className="text-3xl font-bold text-[#1E1B17] mt-1">{value}</p>
    </Link>
  );
}
