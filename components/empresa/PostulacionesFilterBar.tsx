'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'new', label: 'Nuevas' },
  { value: 'reviewed', label: 'Revisadas' },
  { value: 'contacted', label: 'Contactadas' },
  { value: 'hired', label: 'Contratadas' },
  { value: 'discarded', label: 'Descartadas' },
];

type JobOption = { id: number; title: string };

export default function PostulacionesFilterBar({
  status,
  jobId,
  jobs,
}: {
  status: string;
  jobId: string;
  jobs: JobOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <select
        value={jobId}
        onChange={(e) => updateParam('job', e.target.value)}
        className="flex-1 px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
      >
        <option value="">Todos los empleos</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => updateParam('status', e.target.value)}
        className="px-3 py-2 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-1 focus:ring-[#C0362A]"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
