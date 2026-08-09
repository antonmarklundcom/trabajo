import type { Metadata } from 'next';
import { requireCandidate } from '@/lib/auth-candidate';
import { listCityOptions } from '@/lib/db/taxonomy';
import { listCandidateExperiences } from '@/lib/db/candidate-profile';
import { getCurrentCandidateCv } from '@/lib/db/candidate-cvs';
import ProfileForm from '@/components/postulante/ProfileForm';
import ExperienceManager from '@/components/postulante/ExperienceManager';
import CvUploader from '@/components/postulante/CvUploader';

export const metadata: Metadata = {
  title: 'Mi perfil — Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function PostulantePerfilPage() {
  const candidate = await requireCandidate();

  const [cities, experiences, currentCv] = await Promise.all([
    listCityOptions(),
    listCandidateExperiences(candidate.id),
    getCurrentCandidateCv(candidate.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Mi perfil</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Tu perfil es privado. Solo lo ven las empresas a las que decidas postularte.
        </p>
      </div>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17] mb-4">Datos personales</h2>
        <ProfileForm
          initial={{
            name: candidate.name,
            phone: candidate.phone,
            cityId: candidate.cityId,
            headline: candidate.headline,
          }}
          cities={cities}
        />
      </section>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17] mb-4">CV</h2>
        <CvUploader currentCv={currentCv ? { id: currentCv.id, originalFilename: currentCv.originalFilename, sizeBytes: currentCv.sizeBytes } : null} />
      </section>

      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17] mb-4">Experiencia laboral</h2>
        <ExperienceManager experiences={experiences} />
      </section>
    </div>
  );
}
