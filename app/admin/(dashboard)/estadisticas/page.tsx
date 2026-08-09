import type { Metadata } from 'next';
import {
  getApplicationFunnel,
  getApplicationsByCategory,
  getApplicationsByCity,
  getApplicationsPerWeek,
  getCandidateSignupsPerWeek,
  getEmployerActivity,
  getHeadlineCounts,
  type LabeledCount,
  type WeeklyPoint,
} from '@/lib/db/stats';

export const metadata: Metadata = {
  title: 'Estadísticas — trabajo.com.py',
  robots: { index: false, follow: false },
};

const FUNNEL_LABELS: Record<string, string> = {
  new: 'Nueva',
  reviewed: 'Revisada',
  contacted: 'Contactado',
  discarded: 'Descartada',
  hired: 'Contratado',
};

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-4">
      <p className="text-xs uppercase tracking-wider text-[#8A8378]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1E1B17]">{value.toLocaleString('es-PY')}</p>
      {hint && <p className="mt-1 text-xs text-[#8A8378]">{hint}</p>}
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 flex-shrink-0 truncate text-[#57514A]">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-[#F5F1EA] overflow-hidden">
        <div className="h-full bg-[#C0362A] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 flex-shrink-0 text-right font-medium text-[#1E1B17]">{count}</span>
    </div>
  );
}

function WeeklyChart({ points, label }: { points: WeeklyPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1E1B17] mb-3">{label}</h3>
      <div className="flex items-end gap-2 h-32">
        {points.map((p) => (
          <div key={p.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1">
            <span className="text-xs text-[#8A8378]">{p.count}</span>
            <div
              className="w-full bg-[#C0362A] rounded-t-[4px]"
              style={{ height: `${Math.max(4, Math.round((p.count / max) * 100))}%` }}
            />
            <span className="text-[10px] text-[#8A8378]">
              {new Date(p.weekStart).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabeledList({ items, title }: { items: LabeledCount[]; title: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
      <h3 className="text-sm font-semibold text-[#1E1B17] mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#57514A]">Sin datos todavía.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <BarRow key={item.label} label={item.label} count={item.count} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function EstadisticasPage() {
  const [headline, applicationsWeekly, signupsWeekly, byCategory, byCity, funnel, employerActivity] =
    await Promise.all([
      getHeadlineCounts(),
      getApplicationsPerWeek(),
      getCandidateSignupsPerWeek(),
      getApplicationsByCategory(),
      getApplicationsByCity(),
      getApplicationFunnel(),
      getEmployerActivity(),
    ]);

  const registeredPct =
    headline.totalApplications > 0
      ? Math.round((headline.registeredApplications / headline.totalApplications) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Estadísticas</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Solo datos agregados. Sin nombres, teléfonos ni CVs — ver{' '}
          <span className="font-medium">Postulantes</span> para el detalle individual, con motivo
          registrado.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Postulaciones totales" value={headline.totalApplications} />
        <StatCard label="Últimos 30 días" value={headline.applicationsLast30d} />
        <StatCard
          label="Con perfil registrado"
          value={headline.registeredApplications}
          hint={`${registeredPct}% del total`}
        />
        <StatCard label="Postulantes registrados" value={headline.totalCandidates} />
        <StatCard label="Activos (30 días)" value={headline.activeCandidates30d} />
        <StatCard label="Empleos publicados" value={headline.publishedJobs} />
        <StatCard label="Sin postulaciones" value={headline.jobsWithZeroApplications} hint="empleos publicados" />
        <StatCard label="Destacados activos" value={headline.featuredJobsActive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
          <WeeklyChart points={applicationsWeekly} label="Postulaciones por semana" />
        </div>
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
          <WeeklyChart points={signupsWeekly} label="Registros de postulantes por semana" />
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h3 className="text-sm font-semibold text-[#1E1B17] mb-4">
          Embudo de postulaciones
          <span className="ml-2 font-normal text-xs text-[#8A8378]">
            (depende de que las empresas actualicen el estado)
          </span>
        </h3>
        <div className="space-y-2.5">
          {Object.entries(funnel).map(([status, n]) => (
            <BarRow
              key={status}
              label={FUNNEL_LABELS[status] ?? status}
              count={n}
              max={Math.max(1, ...Object.values(funnel))}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LabeledList items={byCategory} title="Postulaciones por categoría" />
        <LabeledList items={byCity} title="Postulaciones por ciudad" />
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-x-auto">
        <div className="px-6 py-4 border-b border-[#E7E1D6]">
          <h3 className="text-sm font-semibold text-[#1E1B17]">Actividad de empresas</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E1D6] text-left text-xs uppercase tracking-wider text-[#57514A]">
              <th className="px-6 py-3 font-medium">Empresa</th>
              <th className="px-6 py-3 font-medium">Empleos publicados</th>
              <th className="px-6 py-3 font-medium">Postulaciones recibidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E1D6]">
            {employerActivity.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-[#57514A]">
                  Sin empresas todavía.
                </td>
              </tr>
            ) : (
              employerActivity.map((row) => (
                <tr key={row.companyId} className="hover:bg-[#F5F1EA]">
                  <td className="px-6 py-3 font-medium text-[#1E1B17]">{row.companyName}</td>
                  <td className="px-6 py-3 text-[#57514A]">{row.jobsPosted}</td>
                  <td className="px-6 py-3 text-[#57514A]">{row.applicationsReceived}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
