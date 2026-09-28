import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor, jobTypeRobots } from '@/lib/seo';
import { INTENT_LANDINGS } from '@/lib/seo/intent-landings';
import { GUIDES } from '@/lib/guides';
import IntentLanding, { intentLandingTotal, pageFromSearchParams, type SearchParams } from '@/components/IntentLanding';
import type { FaqItem } from '@/components/guide/GuidePage';

// Keyword groups (PLAN-SEO.md §0): "trabajo remoto paraguay", "trabajos
// remotos", "trabajo online paraguay", "trabajo desde casa paraguay",
// "trabajos online desde casa", "tele trabajo", "trabajo remotos sin
// experiencia", "trabajos freelance paraguay".

export const revalidate = 300;

const PATH = INTENT_LANDINGS.remoto.path;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = pageFromSearchParams(await searchParams);
  const suffix = page > 1 ? ` — página ${page}` : '';
  return {
    title: `Trabajo remoto en Paraguay: empleos online y desde casa${suffix}`,
    description:
      'Ofertas de trabajo remoto y empleos desde casa publicados por empresas de Paraguay. Cómo conseguir un trabajo online, también sin experiencia, y cómo evitar estafas.',
    robots: jobTypeRobots(await intentLandingTotal('remoto')),
    alternates: { canonical: canonicalFor(page > 1 ? `${PATH}?page=${page}` : PATH) },
  };
}

const FAQ: FaqItem[] = [
  {
    q: '¿El trabajo remoto tiene los mismos derechos que el presencial?',
    a: 'Sí, cuando es en relación de dependencia. La Ley N.º 6738/2021 de teletrabajo establece que quien teletrabaja tiene los mismos derechos laborales y de seguridad social (IPS) que quien trabaja en la oficina.',
  },
  {
    q: '¿Hay trabajos remotos sin experiencia?',
    a: 'Sí, sobre todo en atención al cliente por chat o teléfono, carga de datos, moderación de contenido y ventas por WhatsApp. Suelen pedir buena conexión, computadora y redacción clara.',
  },
  {
    q: '¿Cómo sé si una oferta de trabajo desde casa es falsa?',
    a: 'Desconfiá si te piden pagar un curso, un “kit” o una inscripción para empezar, si prometen mucho dinero por pocas horas o si el contacto evita decir el nombre de la empresa. Un empleador serio nunca te cobra por trabajar.',
  },
];

export default async function TrabajoRemotoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <IntentLanding
      landing="remoto"
      h1="Trabajo remoto en Paraguay"
      intro={
        <p>
          Empleos remotos y trabajos online publicados por empresas de Paraguay: trabajá desde casa,
          con los mismos derechos que en la oficina. Todos los avisos pasan por nuestro equipo antes
          de publicarse, y te postulás gratis por WhatsApp.
        </p>
      }
      emptyText="En este momento no hay empleos 100 % remotos publicados. Mirá también los híbridos entre todas las ofertas."
      searchParams={await searchParams}
      faq={FAQ}
    >
      <h2>Cómo conseguir trabajo remoto desde Paraguay</h2>
      <p>
        El trabajo remoto dejó de ser una rareza: empresas paraguayas de tecnología, atención al
        cliente, marketing y administración contratan personal que trabaja desde casa todo el tiempo o
        algunos días por semana (modalidad híbrida). Para conseguir uno:
      </p>
      <ul>
        <li>
          <strong>Mostrá que sabés trabajar solo/a.</strong> En tu{' '}
          <Link href={GUIDES.curriculum.href}>curriculum</Link>, contá proyectos que hayas hecho con
          autonomía y las herramientas que manejás (Google Drive, Excel, Zoom, sistemas de tickets).
        </li>
        <li>
          <strong>Cuidá la comunicación escrita.</strong> En un trabajo online, tus mensajes son tu
          presencia: la primera impresión es cómo redactás la postulación.
        </li>
        <li>
          <strong>Tené el equipo listo:</strong> computadora, conexión estable y un lugar tranquilo para
          videollamadas. Muchas entrevistas remotas son por videollamada o WhatsApp.
        </li>
      </ul>

      <h2>Qué trabajos online se pueden hacer desde casa</h2>
      <ul>
        <li><strong>Atención al cliente y call center</strong> por chat, correo o teléfono.</li>
        <li><strong>Tecnología:</strong> programación, soporte técnico, datos (<Link href="/trabajo/tecnologia">empleos de tecnología</Link>).</li>
        <li><strong>Marketing:</strong> community manager, diseño, redacción (<Link href="/trabajo/marketing">empleos de marketing</Link>).</li>
        <li><strong>Administración y contabilidad:</strong> carga de datos, facturación, asistente virtual.</li>
        <li><strong>Ventas</strong> por teléfono o WhatsApp.</li>
      </ul>

      <h2>Trabajo remoto sin experiencia</h2>
      <p>
        Los puestos remotos de entrada existen, pero la competencia es mayor que en los presenciales.
        Combiná tu búsqueda con los <Link href="/trabajo-sin-experiencia">trabajos sin experiencia</Link>{' '}
        presenciales o de <Link href="/trabajo-medio-tiempo">medio tiempo</Link>: un primer empleo en
        atención al cliente te da la experiencia que después piden los remotos.
      </p>

      <h2>Teletrabajo en relación de dependencia o freelance</h2>
      <p>
        No es lo mismo. En el <strong>teletrabajo en relación de dependencia</strong>, regulado por la
        Ley N.º 6738/2021, tenés sueldo, IPS, aguinaldo y vacaciones como cualquier empleado. Como{' '}
        <strong>freelance</strong> o independiente, cobrás por proyecto, facturás y te encargás de tus
        propios aportes. Antes de aceptar, preguntá cuál de los dos es.
      </p>

      <h2>Cómo evitar estafas de trabajo desde casa</h2>
      <p>
        Los avisos falsos se concentran en el “trabajo desde casa”. Nunca pagues para empezar a
        trabajar, no mandes fotos de tu cédula antes de una entrevista y desconfiá de sueldos
        demasiado altos por pocas horas. Leé{' '}
        <Link href="/blog/como-detectar-un-aviso-de-empleo-falso">cómo detectar un aviso de empleo falso</Link>.
      </p>
    </IntentLanding>
  );
}
