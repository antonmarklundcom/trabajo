import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor, jobTypeRobots } from '@/lib/seo';
import { INTENT_LANDINGS } from '@/lib/seo/intent-landings';
import { GUIDES } from '@/lib/guides';
import IntentLanding, { intentLandingTotal, pageFromSearchParams, type SearchParams } from '@/components/IntentLanding';
import type { FaqItem } from '@/components/guide/GuidePage';

// Keyword groups (PLAN-SEO.md §0): "trabajo medio tiempo paraguay",
// "trabajo a tiempo parcial", "empleo medio tiempo paraguay", "trabajos de
// medio tiempo para estudiantes paraguay", "bolsa de trabajo paraguay medio
// tiempo", "pasantias paraguay". Copy adapted from
// content/blog-drafts/trabajo-de-medio-tiempo-para-estudiantes.md.

export const revalidate = 300;

const PATH = INTENT_LANDINGS.medioTiempo.path;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = pageFromSearchParams(await searchParams);
  const suffix = page > 1 ? ` — página ${page}` : '';
  return {
    title: `Trabajo de medio tiempo en Paraguay, también para estudiantes${suffix}`,
    description:
      'Empleos de medio tiempo y tiempo parcial en Paraguay: turnos de mañana, tarde o fin de semana, ideales para estudiantes. Qué preguntar y cómo postularte gratis.',
    robots: jobTypeRobots(await intentLandingTotal('medioTiempo')),
    alternates: { canonical: canonicalFor(page > 1 ? `${PATH}?page=${page}` : PATH) },
  };
}

const FAQ: FaqItem[] = [
  {
    q: '¿Un trabajo de medio tiempo tiene IPS y aguinaldo?',
    a: 'Si es un empleo en relación de dependencia, sí: corresponde IPS, y el aguinaldo se calcula sobre lo que cobraste en el año, igual que en jornada completa.',
  },
  {
    q: '¿Qué diferencia hay entre medio tiempo y pasantía?',
    a: 'El medio tiempo es un empleo con jornada reducida. La pasantía es una práctica formativa vinculada a tu carrera, normalmente con un convenio entre la empresa y tu institución. Preguntá cuál es antes de aceptar, porque cambian tus derechos.',
  },
  {
    q: '¿Qué trabajos de medio tiempo hay para estudiantes?',
    a: 'Ventas y promotoría, cajero/a, call center con turnos cortos, gastronomía en turnos de noche o fin de semana, clases particulares y tareas de tu carrera como auxiliar contable o soporte técnico.',
  },
];

export default async function MedioTiempoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <IntentLanding
      landing="medioTiempo"
      h1="Trabajo de medio tiempo en Paraguay"
      intro={
        <p>
          Empleos de medio tiempo y tiempo parcial: turnos de mañana, de tarde o de fin de semana, para
          combinar con el estudio u otra actividad. Postulate gratis, directo por WhatsApp.
        </p>
      }
      emptyText="En este momento no hay empleos de medio tiempo publicados."
      searchParams={await searchParams}
      faq={FAQ}
    >
      <h2>Trabajos de medio tiempo para estudiantes</h2>
      <p>
        Trabajar mientras estudiás te da ingresos, experiencia para el CV y contactos en tu área. Estos
        puestos aparecen seguido con turnos parciales:
      </p>
      <ul>
        <li><strong>Ventas y promotoría</strong> en comercios y shoppings (<Link href="/trabajo/ventas">empleos de ventas</Link>).</li>
        <li><strong>Cajero/a y call center</strong> con turnos cortos (<Link href="/trabajo/atencion-al-cliente">atención al cliente</Link>).</li>
        <li><strong>Gastronomía:</strong> mozos/as y ayudantes de cocina de noche o fin de semana (<Link href="/trabajo/gastronomia">gastronomía</Link>).</li>
        <li><strong>Tareas de tu carrera:</strong> auxiliar contable, soporte técnico, redes sociales.</li>
      </ul>
      <p>
        Si podés, elegí algo relacionado con lo que estudiás: un medio tiempo en tu área vale doble en
        el <Link href={GUIDES.curriculum.href}>curriculum</Link>.
      </p>

      <h2>Medio tiempo, pasantía y changa: no es lo mismo</h2>
      <ul>
        <li><strong>Empleo de medio tiempo:</strong> relación laboral con jornada reducida, con IPS, aguinaldo y vacaciones.</li>
        <li><strong>Pasantía:</strong> práctica formativa vinculada a tu carrera, generalmente con convenio con tu institución.</li>
        <li><strong>Changa o trabajo por día:</strong> trabajo puntual, sin continuidad ni los derechos de una relación estable.</li>
      </ul>

      <h2>Cómo presentarte y qué preguntar</h2>
      <p>
        En tu postulación, poné tu carrera y en qué año estás, y tu disponibilidad exacta (“lunes a
        viernes de 7 a 13 y sábados”). Antes de aceptar, preguntá:
      </p>
      <ul>
        <li>¿Cuántas horas por semana y en qué horario? ¿Es fijo o rotativo?</li>
        <li>¿Es con IPS?</li>
        <li>¿Qué pasa en época de exámenes?</li>
        <li>¿Hay posibilidad de pasar a jornada completa?</li>
      </ul>
      <p>
        ¿Primer empleo? Mirá también los <Link href="/trabajo-sin-experiencia">trabajos sin experiencia</Link>{' '}
        y el <Link href="/trabajo-remoto">trabajo remoto</Link>. Y para saber cuánto te corresponde,
        usá la <Link href={GUIDES.aguinaldo.href}>calculadora de aguinaldo</Link>.
      </p>
    </IntentLanding>
  );
}
