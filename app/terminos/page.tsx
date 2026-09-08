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
    title: '4. Empresas anunciantes: qué es y qué no es trabajo.com.py',
    body: [
      'trabajo.com.py es un portal de empleos y un software de gestión de postulaciones para empresas que publican vacantes en Paraguay. No somos una agencia de empleo ni un intermediario laboral: no seleccionamos, evaluamos, verificamos, clasificamos ni recomendamos candidatos.',
      'El empleador es responsable de su propio proceso de selección, desde la revisión de las postulaciones recibidas hasta la decisión de a quién contactar y contratar. No garantizamos que una vacante reciba postulaciones ni que una postulación derive en una contratación.',
    ],
  },
  {
    title: '5. Obligaciones de la empresa sobre los datos de postulantes',
    body: [
      'La empresa que recibe datos de postulantes a través del portal es responsable del tratamiento de esos datos personales conforme a la Ley N° 7593/2025 de Protección de Datos Personales de Paraguay.',
      'Eso implica que la empresa: (a) solo puede usar los datos de un postulante para evaluar su candidatura a la vacante concreta a la que se postuló; (b) no puede revender, ceder ni compartir esos datos con terceros, ni incorporarlos a una base de datos propia de candidatos; y (c) debe respetar los principios de no discriminación en sus publicaciones y en su proceso de selección, conforme a la legislación laboral paraguaya.',
      'El incumplimiento de estas obligaciones puede derivar en la suspensión de la cuenta de la empresa en el portal.',
    ],
  },
  {
    title: '6. Promoción de lanzamiento',
    body: [
      'Durante la promoción de lanzamiento, los primeros 100 avisos aprobados por nuestro equipo reciben el servicio Destacado por 90 días, sin costo. La promoción se aplica sobre avisos que ya pasaron la revisión del equipo: no otorga la aprobación ni la acelera.',
      'Se aplica una sola vez por aviso, no tiene valor en efectivo, no es transferible ni canjeable por otro servicio. Podemos dar por terminada la promoción cuando se agoten los 100 cupos o en cualquier momento, sin que eso afecte los Destacados ya otorgados.',
      'Cumplidos los 90 días, el aviso deja de estar destacado y sigue publicado con normalidad. La renovación del Destacado se cobra al precio vigente.',
    ],
  },
  {
    title: '7. Uso correcto del sitio',
    body: [
      'Te comprometés a usar el sitio de buena fe: no cargar información falsa, no suplantar a otras personas o empresas, no extraer datos de forma masiva (scraping) y no interferir con el funcionamiento técnico del portal.',
    ],
  },
  {
    title: '8. Contenido de terceros',
    body: [
      'Las ofertas publicadas son responsabilidad de las empresas anunciantes. Hacemos esfuerzos razonables de curaduría, pero no garantizamos la exactitud de cada anuncio. Si detectás una oferta sospechosa, avisanos desde la página de contacto. Nunca pagues dinero para postularte a un empleo: ninguna oferta legítima lo exige.',
    ],
  },
  {
    title: '9. Propiedad intelectual',
    body: [
      'La marca, el diseño y el contenido propio del sitio pertenecen a trabajo.com.py. No podés reproducirlos con fines comerciales sin autorización.',
    ],
  },
  {
    title: '10. Limitación de responsabilidad',
    body: [
      'El sitio se ofrece "tal cual". En la medida permitida por la ley, no respondemos por daños derivados del uso del portal, de la relación entre candidatos y empresas, ni de interrupciones técnicas del servicio.',
    ],
  },
  {
    title: '11. Privacidad',
    body: [
      'El tratamiento de tus datos personales se rige por nuestra Política de privacidad, disponible en /privacidad.',
    ],
  },
  {
    title: '12. Ley aplicable',
    body: [
      'Estos términos se rigen por las leyes de la República del Paraguay. Cualquier controversia se someterá a los tribunales ordinarios de la ciudad de Asunción.',
    ],
  },
  {
    title: '13. Cambios',
    body: [
      'Podemos actualizar estos términos; la versión vigente estará siempre publicada en esta página. El uso continuado del sitio implica la aceptación de los términos actualizados.',
    ],
  },
];

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-ink">
        Términos y condiciones
      </h1>
      <p className="mt-3 text-sm text-ink-3">Última actualización: septiembre de 2026</p>

      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-secondary">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
