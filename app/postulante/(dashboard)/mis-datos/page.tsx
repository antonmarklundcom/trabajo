// /postulante/mis-datos — the four ARCO rights in one page
// (PLAN-PHASE2.md §4.2 / §4.4).
//
//   Acceso        → the JSON export, served by /api/postulante/mis-datos/export
//   Rectificación → /postulante/perfil, linked from here. No second write path
//                   onto the same columns is built for this page: rectification
//                   IS the profile editor, and duplicating it would mean two
//                   places to keep correct.
//   Cancelación   → per-application withdrawal (§4.2) and account deletion (§4.4)
//   Oposición     → withdrawing the application consents is the concrete form
//                   this right takes here, so it shares the section above.
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireCandidate } from '@/lib/auth-candidate';
import { listCandidateApplications } from '@/lib/db/candidate-applications';
import WithdrawButton from '@/components/postulante/WithdrawButton';
import DeleteAccountForm from '@/components/postulante/DeleteAccountForm';

export const metadata: Metadata = {
  title: 'Mis datos — Postulantes — trabajo.com.py',
  robots: { index: false, follow: false },
};

export default async function MisDatosPage() {
  const candidate = await requireCandidate();
  const applications = await listCandidateApplications(candidate.id);
  const active = applications.filter((app) => !app.redactedAt);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E1B17]">Mis datos</h1>
        <p className="text-sm text-[#57514A] mt-1">
          Acá ejercés tus derechos sobre tus datos personales (Ley N° 7593/2025): acceder a ellos,
          corregirlos, retirar tu consentimiento y eliminarlos.
        </p>
      </div>

      {/* --- Acceso ------------------------------------------------------ */}
      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17]">Descargar mis datos</h2>
        <p className="text-sm text-[#57514A] mt-1">
          Un archivo JSON con todo lo que guardamos sobre vos: tu perfil, tu experiencia laboral,
          tus CVs, tus postulaciones, tus consentimientos y cada vez que nuestro equipo accedió a
          tus datos.
        </p>
        <a
          href="/api/postulante/mis-datos/export"
          className="mt-4 inline-block px-4 py-2 rounded-[10px] text-sm font-medium text-white bg-[#C0362A] hover:bg-[#A32C22] transition-colors"
        >
          Descargar mis datos (JSON)
        </a>
        <p className="text-xs text-[#8A8378] mt-3">
          Los archivos de CV no van dentro del JSON: los descargás desde{' '}
          <Link href="/postulante/perfil" className="underline hover:text-[#C0362A]">
            Mi perfil
          </Link>
          .
        </p>
      </section>

      {/* --- Rectificación ------------------------------------------------ */}
      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17]">Corregir mis datos</h2>
        <p className="text-sm text-[#57514A] mt-1">
          Podés editar tu nombre, tu teléfono, tu ciudad, tu titular, tu experiencia laboral y tu CV
          cuando quieras desde tu perfil. Los cambios se aplican al instante.
        </p>
        <Link
          href="/postulante/perfil"
          className="mt-4 inline-block px-4 py-2 rounded-[10px] text-sm font-medium text-[#1E1B17] border border-[#E7E1D6] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
        >
          Ir a Mi perfil
        </Link>
        <p className="text-xs text-[#8A8378] mt-3">
          Para cambiar el email de tu cuenta, escribinos desde{' '}
          <Link href="/contacto" className="underline hover:text-[#C0362A]">
            Contacto
          </Link>
          .
        </p>
      </section>

      {/* --- Cancelación por postulación (§4.2) --------------------------- */}
      <section className="bg-white rounded-[10px] border border-[#E7E1D6] p-6">
        <h2 className="text-lg font-semibold text-[#1E1B17]">
          Retirar mi consentimiento por postulación
        </h2>
        <p className="text-sm text-[#57514A] mt-1">
          Diste tu consentimiento una vez por cada postulación, para una empresa concreta. Podés
          retirarlo por separado: la empresa deja de ver tus datos de contacto y tu CV para esa
          vacante. Tu cuenta y tus otras postulaciones no se tocan.
        </p>

        {active.length === 0 ? (
          <p className="mt-4 text-sm text-[#8A8378]">
            {applications.length === 0
              ? 'Todavía no te postulaste a ningún empleo.'
              : 'Ya retiraste tu consentimiento en todas tus postulaciones.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#E7E1D6] border-t border-[#E7E1D6]">
            {active.map((app) => (
              <li key={app.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1E1B17] truncate">{app.jobTitle}</p>
                  <p className="text-sm text-[#57514A]">{app.companyName}</p>
                  <p className="text-xs text-[#8A8378] mt-0.5">
                    Postulaste el {new Date(app.createdAt).toLocaleDateString('es-PY')}
                  </p>
                </div>
                <WithdrawButton applicationId={app.id} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-[#8A8378] mt-4">
          Queda registrada la postulación sin tus datos personales, para que la empresa sepa que
          existió y no parezca que la borramos nosotros.
        </p>
      </section>

      {/* --- Cancelación total (§4.4) ------------------------------------- */}
      <section className="bg-white rounded-[10px] border border-[#F3C9C4] p-6">
        <h2 className="text-lg font-semibold text-[#B42318]">Eliminar mi cuenta</h2>
        <p className="text-sm text-[#57514A] mt-1">
          Eliminamos de verdad: no marcamos tu cuenta como &ldquo;inactiva&rdquo;, la borramos.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-[#57514A] list-disc pl-5">
          <li>Se borran los archivos de tus CVs de nuestro almacenamiento.</li>
          <li>Se borran tu perfil, tu experiencia laboral y tus CVs de nuestra base de datos.</li>
          <li>
            En tus postulaciones se borran tu nombre, tu teléfono, tu email, tu mensaje y el enlace
            a tu CV. Queda solo el registro de que existió una postulación a esa vacante, sin datos
            tuyos.
          </li>
          <li>
            Se conservan los registros de consentimiento. No tienen tu nombre ni tu CV: son la
            prueba de qué autorizaste y de que esta eliminación fue pedida por vos.
          </li>
        </ul>

        <p className="text-sm text-[#57514A] mt-4">
          Es inmediato y no se puede deshacer. Si querés guardar una copia, descargá tus datos
          antes.
        </p>

        <div className="mt-5 pt-5 border-t border-[#F3C9C4]">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
