import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CANDIDATE_INACTIVITY_MONTHS,
  APPLICATION_REDACTION_MONTHS,
  CONSENT_RETENTION_MONTHS,
  ACCESS_LOG_RETENTION_MONTHS,
} from '@/lib/retention';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Cómo trabajo.com.py recopila, usa y protege tus datos personales cuando usás nuestro portal de empleos.',
};

const sections = [
  {
    title: '1. Quiénes somos',
    body: [
      'trabajo.com.py es un portal de empleos para Paraguay. Conectamos a personas que buscan trabajo con empresas que publican vacantes. El uso del sitio es gratuito para candidatos.',
      'Para consultas sobre esta política podés escribirnos desde la página de contacto o por WhatsApp.',
    ],
  },
  {
    title: '2. Qué datos recopilamos',
    body: [
      'Cuando te postulás a un empleo o nos escribís, recopilamos los datos que vos nos entregás: nombre, teléfono / WhatsApp, email (opcional) y el mensaje que escribas. Si te postulás por WhatsApp, registramos que hiciste clic en el botón de postulación (puesto, categoría y ciudad), pero la conversación ocurre directamente en WhatsApp.',
      'Si sos una empresa y completás el formulario de publicación, recopilamos los datos de la empresa y del contacto que cargues.',
      'Además, usamos herramientas de analítica web que registran información de navegación de forma agregada (páginas visitadas, tipo de dispositivo). Estos datos no se usan para identificarte personalmente.',
    ],
  },
  {
    title: '3. Para qué usamos tus datos',
    body: [
      'Usamos tus datos exclusivamente para: (a) hacer llegar tu postulación a la empresa que publicó la vacante o a nuestro equipo de selección; (b) responder tus consultas; (c) contactarte por WhatsApp, teléfono o email respecto de tu postulación o publicación; y (d) mejorar el sitio a partir de estadísticas de uso.',
      'No vendemos tus datos personales a terceros.',
    ],
  },
  {
    title: '4. Con quién compartimos datos',
    body: [
      'Tus datos de postulación pueden ser compartidos con la empresa anunciante de la vacante a la que te postulás y con nuestro equipo interno de gestión de candidatos.',
      'Para operar el sitio usamos proveedores de servicios (alojamiento web, gestión de contactos y planillas, analítica). Estos proveedores procesan datos por cuenta nuestra y no pueden usarlos para fines propios.',
    ],
  },
  {
    title: '5. Para empresas anunciantes: qué reciben',
    body: [
      'Cuando te postulás a una vacante publicada por una empresa, esa empresa recibe tu nombre, teléfono, email, el mensaje o perfil que hayas compartido y, si corresponde, tu CV — únicamente para la vacante a la que te postulaste.',
      'La empresa no tiene acceso a tus postulaciones a otras vacantes ni a las de otros postulantes, y no puede buscar ni examinar perfiles fuera de sus propias publicaciones. trabajo.com.py no opera una base de datos de candidatos consultable por las empresas.',
    ],
  },
  {
    title: '6. Acceso del equipo de trabajo.com.py',
    body: [
      'El equipo que opera trabajo.com.py puede acceder a los datos de postulantes para operar el portal, moderar contenido, dar soporte y atender reportes de abuso. Ese acceso queda registrado internamente (quién accedió, cuándo y con qué motivo) y es independiente del acceso que tienen las empresas anunciantes: el equipo del portal no participa en la selección de candidatos de ninguna empresa.',
    ],
  },
  {
    title: '7. Tu perfil de postulante (cuenta): privacidad y conservación',
    body: [
      'Si creás una cuenta de postulante, tu perfil (nombre, teléfono, ciudad, titular, experiencia laboral) y tu CV se guardan de forma privada. Tu perfil no es público ni buscable: nadie puede navegarlo ni buscarlo, ni empresas ni terceros. Una empresa solo ve tus datos cuando vos elegís postularte a una de sus vacantes, y solo para esa postulación puntual.',
      `Guardamos tu perfil y tu CV mientras tu cuenta esté activa. Si no volvés a iniciar sesión durante ${CANDIDATE_INACTIVITY_MONTHS} meses, eliminamos tu perfil y tu cuenta.`,
      `Los datos personales de una postulación (nombre, teléfono, email, mensaje y el CV vinculado a esa postulación) se eliminan ${APPLICATION_REDACTION_MONTHS} meses después de que esa vacante se cierre o archive. El registro de que existió la postulación permanece, sin ningún dato personal.`,
      `El registro de tu consentimiento (qué aceptaste, cuándo y para qué) se conserva ${CONSENT_RETENTION_MONTHS / 12} años después de que los datos que autorizaba se eliminen, porque es la prueba de que el tratamiento fue autorizado. No contiene tu CV ni tu mensaje.`,
      `Cuando nuestro equipo accede a los datos de un postulante para moderación, soporte o una denuncia de abuso, ese acceso queda registrado durante ${ACCESS_LOG_RETENTION_MONTHS} meses.`,
    ],
  },
  {
    title: '8. Conservación y seguridad (postulaciones anónimas)',
    body: [
      'Para quienes se postulan sin crear una cuenta, conservamos los datos de esa postulación durante el tiempo necesario para la gestión de postulaciones y para cumplir obligaciones legales. Aplicamos medidas razonables de seguridad técnica y organizativa para proteger tu información.',
    ],
  },
  {
    title: '9. Tus derechos (ARCO)',
    body: [
      'De acuerdo con la Ley N° 7593/2025 de Protección de Datos Personales de Paraguay, tenés derecho a acceder, rectificar, cancelar (eliminar) y oponerte al tratamiento de tus datos personales en cualquier momento.',
      'Si tenés una cuenta de postulante, ejercé estos derechos vos mismo, sin esperar respuesta, desde tu panel: descargá una copia de todo lo que guardamos sobre vos, corregí tu perfil, retirá tu consentimiento para una postulación puntual, o eliminá tu cuenta por completo. La eliminación de cuenta es definitiva e inmediata: no queda una copia oculta ni una forma de deshacerla.',
      'Si no tenés cuenta, o preferís hacerlo por otro medio, escribinos desde la página de contacto indicando tu pedido; te responderemos a la brevedad.',
    ],
  },
  {
    title: '10. Cookies y analítica',
    body: [
      'El sitio puede usar cookies y tecnologías similares con fines de analítica (por ejemplo, Google Analytics) para entender cómo se usa el portal. Podés bloquear las cookies desde la configuración de tu navegador sin que eso impida usar el sitio.',
    ],
  },
  {
    title: '11. Cambios a esta política',
    body: [
      'Podemos actualizar esta política para reflejar cambios en el sitio o en la normativa. La versión vigente estará siempre publicada en esta página.',
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-ink">
        Política de privacidad
      </h1>
      <p className="mt-3 text-sm text-ink-3">Última actualización: julio de 2026</p>

      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-secondary">
                {p}
              </p>
            ))}
            {s.title.startsWith('9.') && (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-secondary">
                Accedé a tu panel de derechos en{' '}
                <Link href="/postulante/mis-datos" className="text-brand hover:underline">
                  /postulante/mis-datos
                </Link>
                , o escribinos desde{' '}
                <Link href="/contacto" className="text-brand hover:underline">
                  Contacto
                </Link>
                .
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
