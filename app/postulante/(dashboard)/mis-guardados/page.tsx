import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCandidate } from '@/lib/auth-candidate';
import { listSavedJobs } from '@/lib/db/candidate-saved-jobs';
import UnsaveJobButton from '@/components/postulante/UnsaveJobButton';

export const metadata: Metadata = {
  title: 'Mis guardados — trabajo.com.py',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string }>;

export default async function MisGuardadosPage({ searchParams }: { searchParams: SearchParams }) {
  const candidate = await requireCandidate();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { savedJobs, total } = await listSavedJobs(candidate.id, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E1B17]">Mis guardados</h1>
        <p className="text-sm text-[#57514A] mt-1">{total} empleo(s) guardado(s).</p>
      </div>

      {savedJobs.length === 0 ? (
        <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-8 text-center">
          <p className="text-sm text-[#57514A]">Todavía no guardaste ningún empleo.</p>
          <Link href="/empleos" className="mt-3 inline-block text-sm font-medium text-[#C0362A] hover:underline">
            Ver empleos disponibles
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {savedJobs.map((saved) => (
              <li key={saved.id} className="bg-white rounded-[10px] border border-[#E7E1D6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {saved.isAvailable ? (
                      <Link
                        href={`/empleos/${saved.jobSlug}`}
                        className="font-medium text-[#1E1B17] hover:text-[#C0362A]"
                      >
                        {saved.jobTitle}
                      </Link>
                    ) : (
                      <span className="font-medium text-[#8A8378]">{saved.jobTitle}</span>
                    )}
                    <p className="text-sm text-[#57514A]">{saved.companyName}</p>
                    <p className="text-xs text-[#8A8378] mt-1">
                      Guardado el {new Date(saved.createdAt).toLocaleDateString('es-PY')}
                    </p>
                  </div>
                  {!saved.isAvailable && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F1EA] text-[#8A8378] whitespace-nowrap">
                      Ya no disponible
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <UnsaveJobButton jobSlug={saved.jobSlug} />
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <a
                  href={`/postulante/mis-guardados?page=${page - 1}`}
                  className="px-4 py-2 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#1E1B17] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
                >
                  ← Anterior
                </a>
              )}
              <span className="text-sm text-[#57514A]">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`/postulante/mis-guardados?page=${page + 1}`}
                  className="px-4 py-2 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#1E1B17] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
                >
                  Siguiente →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
