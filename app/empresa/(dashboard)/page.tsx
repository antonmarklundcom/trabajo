import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCompanyScope } from '@/lib/auth';
import { getEmployerDashboardStats } from '@/lib/db/employer';

export const metadata: Metadata = {
  title: 'Panel — Empresas — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function EmpresaDashboardPage() {
  const { companyId } = await requireCompanyScope();
  const stats = await getEmployerDashboardStats(companyId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Panel</h1>
        <p className="text-sm text-[#57514A] mt-1">Resumen de tu actividad en trabajo.com.py.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Empleos publicados"
          value={stats.publishedCount}
          href="/empresa/empleos?status=published"
        />
        <StatCard
          label="Empleos pendientes"
          value={stats.pendingCount}
          href="/empresa/empleos?status=pending"
          highlight={stats.pendingCount > 0}
        />
        <StatCard
          label="Postulaciones totales"
          value={stats.applicationCount}
          href="/empresa/postulaciones"
        />
        <StatCard
          label="Postulaciones nuevas"
          value={stats.newApplicationCount}
          href="/empresa/postulaciones?status=new"
          highlight={stats.newApplicationCount > 0}
        />
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
