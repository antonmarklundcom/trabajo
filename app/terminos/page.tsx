import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Términos y condiciones de uso del portal de empleos trabajo.com.py.',
};

const sections = [
  {
    title: '1. Aceptación',
    body: [
      'Al usar trabajo.com.py aceptás estos términos y condiciones. Si no estás de acuerdo con alguna parte, te pedimos que no uses el sitio.',
    ],
  },
  {
    title: '2. El servicio',
    body: [
      'trabajo.com.py es un portal que publica ofertas de empleo en Paraguay y facilita el contacto entre candidatos y empresas. El uso del sitio es gratuito para las personas que buscan trabajo.',
      'No somos parte de la relación laboral que pueda surgir entre un candidato y una empresa, ni garantizamos que una postulación derive en una contratación.',
    ],
  },
  {
    title: '3. Publicación de empleos',
    body: [
      'Las empresas pueden solicitar la publicación de vacantes a través del sitio. Nuestro equipo revisa y aprueba las publicaciones antes de que aparezcan en el portal, y puede rechazar o retirar anuncios que resulten falsos, discriminatorios, engañosos o contrarios a la ley paraguaya.',
      'Los planes para empresas, sus precios y condiciones se acuerdan directamente con nuestro equipo comercial.',
    ],
  },
  {
    title: '4. Uso correcto del sitio',
    body: [
      'Te comprometés a usar el sitio de buena fe: no cargar información falsa, no suplantar a otras personas o empresas, no extraer datos de forma masiva (scraping) y no interferir con el funcionamiento técnico del portal.',
    ],
  },
  {
    title: '5. Contenido de terceros',
    body: [
      'Las ofertas publicadas son responsabilidad de las empresas anunciantes. Hacemos esfuerzos razonables de curaduría, pero no garantizamos la exactitud de cada anuncio. Si detectás una oferta sospechosa, avisanos desde la página de contacto. Nunca pagues dinero para postularte a un empleo: ninguna oferta legítima lo exige.',
    ],
  },
  {
    title: '6. Propiedad intelectual',
    body: [
      'La marca, el diseño y el contenido propio del sitio pertenecen a trabajo.com.py. No podés reproducirlos con fines comerciales sin autorización.',
    ],
  },
  {
    title: '7. Limitación de responsabilidad',
    body: [
      'El sitio se ofrece "tal cual". En la medida permitida por la ley, no respondemos por daños derivados del uso del portal, de la relación entre candidatos y empresas, ni de interrupciones técnicas del servicio.',
    ],
  },
  {
    title: '8. Privacidad',
    body: [
      'El tratamiento de tus datos personales se rige por nuestra Política de privacidad, disponible en /privacidad.',
    ],
  },
  {
    title: '9. Ley aplicable',
    body: [
      'Estos términos se rigen por las leyes de la República del Paraguay. Cualquier controversia se someterá a los tribunales ordinarios de la ciudad de Asunción.',
    ],
  },
  {
    title: '10. Cambios',
    body: [
      'Podemos actualizar estos términos; la versión vigente estará siempre publicada en esta página. El uso continuado del sitio implica la aceptación de los términos actualizados.',
    ],
  },
];

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-[#1E1B17]">
        Términos y condiciones
      </h1>
      <p className="mt-3 text-sm text-[#8A8378]">Última actualización: julio de 2026</p>

      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-[#1E1B17]">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-[#57514A]">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
