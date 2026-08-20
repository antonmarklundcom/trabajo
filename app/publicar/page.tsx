import type { Metadata } from 'next';
import { getCategories, getCities } from '@/lib/data';
import EmployerForm from '@/components/EmployerForm';

export const metadata: Metadata = {
  title: 'Publicá tu empleo gratis en Paraguay',
  description:
    'Publicá tu oferta de empleo en trabajo.com.py. Nuestro equipo te ayuda a encontrar el candidato ideal. Gratuito para comenzar.',
};

export default async function PublicarPage() {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">
          Publicá tu empleo gratis
        </h1>
        <p className="mt-4 text-base text-ink-secondary max-w-xl mx-auto">
          Completá el formulario y nuestro equipo te contactará en menos de 24 horas para publicar tu oferta.
          Gratuito para comenzar.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
          {[
            { icon: '⚡', label: 'Respuesta rápida' },
            { icon: '🆓', label: 'Gratis para empezar' },
            { icon: '🇵🇾', label: 'Solo Paraguay' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium text-ink-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
        <EmployerForm categories={categories} cities={cities} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-secondary">
        Al enviar este formulario, nuestro equipo revisará tu solicitud y te contactará para coordinar la publicación.
        No publicamos datos de contacto de empleadores sin su consentimiento.
      </p>
    </div>
  );
}
