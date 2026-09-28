import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import { INTENT_LANDINGS } from '@/lib/seo/intent-landings';
import { GUIDES } from '@/lib/guides';
import IntentLanding, { pageFromSearchParams, type SearchParams } from '@/components/IntentLanding';
import type { FaqItem } from '@/components/guide/GuidePage';

// Keyword groups (PLAN-SEO.md §1): "trabajo en paraguay sin experiencia",
// "trabajo sin experiencia", "trabajo para jovenes sin experiencia",
// "trabajos paraguay para jóvenes", "primer empleo", "ayudante de cocina sin
// experiencia", "trabajo en supermercados sin experiencia", "busco trabajo de
// lunes a viernes en paraguay sin experiencia", "asesor comercial sin
// experiencia". Copy adapted from content/blog-drafts/como-buscar-trabajo-sin-experiencia-en-asuncion.md.

export const revalidate = 300;

const PATH = INTENT_LANDINGS.sinExperiencia.path;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = pageFromSearchParams(await searchParams);
  const suffix = page > 1 ? ` — página ${page}` : '';
  return {
    title: `Trabajo sin experiencia en Paraguay: primer empleo y jóvenes${suffix}`,
    description:
      'Ofertas de trabajo sin experiencia en Paraguay para jóvenes y primer empleo: cajeros, ventas, gastronomía, depósito y más. Postulate gratis por WhatsApp.',
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalFor(page > 1 ? `${PATH}?page=${page}` : PATH) },
  };
}

const FAQ: FaqItem[] = [
  {
    q: '¿Qué trabajos hay sin experiencia en Paraguay?',
    a: 'Los que más se repiten son cajero/a, vendedor/a de salón, promotor/a, atención al cliente y call center, ayudante de cocina, mozo/a, auxiliar de depósito y ayudante de reparto.',
  },
  {
    q: '¿Qué pongo en el CV si no tengo experiencia?',
    a: 'Formación, experiencia práctica (negocio familiar, changas, ventas por redes, voluntariado), habilidades concretas, idiomas y disponibilidad horaria. Tenemos una guía con ejemplo y plantilla gratis.',
  },
  {
    q: '¿Hay trabajos sin experiencia de lunes a viernes?',
    a: 'Sí, sobre todo en administración, depósitos y call centers. En comercio y gastronomía es más común trabajar también los sábados o por turnos; leé bien el horario en cada aviso.',
  },
];

export default async function SinExperienciaPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <IntentLanding
      landing="sinExperiencia"
      h1="Trabajo sin experiencia en Paraguay"
      intro={
        <p>
          Ofertas de empleo que no piden experiencia previa: ideales para tu primer trabajo, para
          jóvenes y para quien cambia de rubro. Muchas empresas capacitan a su cargo. Postulate gratis,
          directo por WhatsApp.
        </p>
      }
      emptyText="En este momento no hay avisos marcados “sin experiencia”. Muchos puestos junior también aceptan perfiles de entrada."
      searchParams={await searchParams}
      faq={FAQ}
    >
      <h2>Rubros donde es más fácil conseguir tu primer empleo</h2>
      <p>
        Cada búsqueda depende del momento, pero estos rubros suelen tener puestos de entrada que no
        piden experiencia:
      </p>
      <ul>
        <li><Link href="/trabajo/atencion-al-cliente">Atención al cliente</Link>: cajeros/as, recepción, call center, atención por WhatsApp.</li>
        <li><Link href="/trabajo/ventas">Ventas</Link>: vendedores/as de salón, promotores/as, asesores comerciales junior.</li>
        <li><Link href="/trabajo/gastronomia">Gastronomía</Link>: ayudantes de cocina, mozos/as, bacheros/as.</li>
        <li><Link href="/trabajo/logistica">Logística</Link>: auxiliares de depósito, ayudantes de reparto.</li>
        <li><Link href="/trabajo/administracion">Administración</Link>: carga de datos y auxiliares junior, sobre todo para estudiantes.</li>
      </ul>
      <p>
        En los avisos, buscá palabras como “sin experiencia”, “primer empleo”, “capacitación a cargo de
        la empresa” o “junior”.
      </p>

      <h2>Lo que sí tenés para mostrar</h2>
      <p>
        “Sin experiencia” casi nunca significa “sin nada”. Changas, ayudar en el negocio de la familia,
        vender por redes, actividades del colegio o de la iglesia, cursos cortos y hablar castellano y
        guaraní: todo eso va en tu CV, descripto con tareas concretas. Mirá cómo en{' '}
        <Link href={GUIDES.curriculumSinExperiencia.href}>CV sin experiencia (con ejemplo)</Link>.
      </p>

      <h2>Buscá cerca de tu casa</h2>
      <p>
        Muchos comercios, depósitos y fábricas están fuera del centro. Según dónde vivas, un empleo en
        otra ciudad del área metropolitana puede quedarte más cerca: mirá el trabajo en{' '}
        <Link href="/trabajo-en/asuncion">Asunción</Link>,{' '}
        <Link href="/trabajo-en/san-lorenzo">San Lorenzo</Link>,{' '}
        <Link href="/trabajo-en/luque">Luque</Link> o{' '}
        <Link href="/trabajo-en/capiata">Capiatá</Link>. Antes de postularte, calculá el tiempo y el
        costo del viaje de ida y vuelta.
      </p>

      <h2>Un plan semanal para conseguir trabajo</h2>
      <ul>
        <li><strong>Lunes:</strong> revisá los avisos nuevos y anotá los que te interesan.</li>
        <li><strong>Martes y miércoles:</strong> adaptá tu CV y tu mensaje a cada aviso y postulate.</li>
        <li><strong>Jueves:</strong> respondé mensajes y prepará las <Link href={GUIDES.entrevista.href}>entrevistas</Link>.</li>
        <li><strong>Viernes:</strong> hacé seguimiento de lo que mandaste la semana anterior.</li>
      </ul>
      <p>
        Si estudiás, los <Link href="/trabajo-medio-tiempo">trabajos de medio tiempo</Link> te dejan
        combinar las dos cosas. Y ojo con los avisos que te piden plata para empezar: un empleador serio
        nunca cobra por contratarte.
      </p>
    </IntentLanding>
  );
}
