import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import CvSheet from '@/components/guide/CvSheet';
import CvTemplateDownloads from '@/components/guide/CvTemplateDownloads';
import { CV_EXAMPLES } from '@/lib/cv-examples';
import { GUIDES } from '@/lib/guides';

// Keyword groups served here (PLAN-SEO.md §0): "curriculum vitae ejemplos sin
// experiencia laboral", "como hacer un curriculum si no tienes experiencia
// laboral", "ejemplos de cv sin experiencia", "como hacer un currículum para
// mi primer trabajo". Copy adapted from content/blog-drafts/cv-sin-experiencia-paraguay.md,
// which is therefore not published as a separate blog post.

const TITLE = 'CV sin experiencia: cómo hacer tu primer curriculum (con ejemplo)';
const DESCRIPTION =
  'Cómo hacer un curriculum vitae sin experiencia laboral para tu primer trabajo en Paraguay: qué poner, en qué orden, un ejemplo listo para adaptar y plantilla gratis.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.curriculumSinExperiencia.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Qué pongo en el CV si nunca trabajé?',
    a: 'Tu formación, la experiencia práctica que sí tenés (negocio familiar, changas, ventas por redes, voluntariado, pasantías), habilidades concretas, idiomas y tu disponibilidad horaria.',
  },
  {
    q: '¿Puedo poner changas o el negocio de mi familia como experiencia?',
    a: 'Sí. Describí las tareas concretas y cuánto tiempo las hiciste: atención de clientes, manejo de caja, reposición. Para un primer empleo, eso vale.',
  },
  {
    q: '¿Cuánto tiene que medir un CV sin experiencia?',
    a: 'Una sola página. No lo estires con letra grande ni secciones de relleno.',
  },
];

export default function CvSinExperienciaPage() {
  return (
    <GuidePage
      guideKey="curriculumSinExperiencia"
      title="CV sin experiencia: cómo hacer tu primer curriculum"
      description={DESCRIPTION}
      parents={[{ label: 'Curriculum vitae', href: GUIDES.curriculum.href }]}
      crumbLabel="Sin experiencia"
      lede={
        <p>
          Si nunca tuviste un empleo con recibo de sueldo, la sección “Experiencia laboral” parece que
          va a quedar en blanco. Pero casi nadie llega al primer trabajo sin haber hecho nada: ayudaste
          en el negocio de la familia, hiciste changas, vendiste por Instagram u organizaste algo en el
          colegio. Un buen curriculum sin experiencia sabe mostrarlo.
        </p>
      }
      toc={[
        { id: 'orden', label: 'El orden que funciona cuando no tenés experiencia' },
        { id: 'experiencia-practica', label: 'Cómo escribir la experiencia que “no cuenta”' },
        { id: 'habilidades', label: 'Habilidades: concretas, no adjetivos' },
        { id: 'ejemplo', label: 'Ejemplo de CV sin experiencia' },
        { id: 'plantilla', label: 'Plantilla gratis para descargar' },
        { id: 'errores', label: 'Errores que conviene evitar' },
        { id: 'donde-postularte', label: 'Dónde postularte' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['curriculumPlantillas', 'curriculum', 'cartaPresentacion', 'entrevista']}
    >
      <h2 id="orden">El orden que funciona cuando no tenés experiencia</h2>
      <p>
        Un CV sin experiencia entra cómodo en <strong>una sola página</strong>. Cambiá el orden de las
        secciones y poné primero lo que sí tenés:
      </p>
      <ol>
        <li><strong>Datos de contacto:</strong> nombre, ciudad, teléfono con WhatsApp y correo.</li>
        <li><strong>Perfil:</strong> dos o tres líneas sobre quién sos y qué puesto buscás.</li>
        <li><strong>Formación:</strong> colegio, curso técnico, carrera en curso.</li>
        <li><strong>Experiencia práctica:</strong> changas, emprendimientos, voluntariado, pasantías.</li>
        <li><strong>Habilidades e idiomas:</strong> lo concreto que sabés hacer.</li>
        <li><strong>Disponibilidad:</strong> horarios y zona en la que podés trabajar.</li>
      </ol>
      <p>
        Este formato, ordenado por habilidades y no por fechas, se llama CV funcional (más sobre{' '}
        <Link href={`${GUIDES.curriculum.href}#tipos`}>los tipos de curriculum</Link>).
      </p>

      <h2 id="experiencia-practica">Cómo escribir la experiencia que “no cuenta”</h2>
      <p>La clave es describir tareas, no títulos. Compará:</p>
      <ul>
        <li><em>Débil:</em> “Ayudé en el negocio de mi tía.”</li>
        <li>
          <em>Mejor:</em> “Atención de clientes y manejo de caja en despensa familiar, fines de semana
          durante dos años. Reposición de mercadería y control de stock.”
        </li>
      </ul>
      <p>
        La segunda dice lo mismo, pero ahora el empleador ve que sabés atender gente, manejar plata y
        ser constante. Hacé lo mismo con todo lo que hiciste: si vendiste por redes, contá qué vendías
        y cómo coordinabas las entregas; si fuiste delegado de curso, qué organizabas.
      </p>

      <h2 id="habilidades">Habilidades: concretas, no adjetivos</h2>
      <p>
        Evitá la lista “responsable, proactivo, dinámico”: todos la ponen y no se puede comprobar.
        Preferí lo que alguien pueda verificar en una charla o una prueba:
      </p>
      <ul>
        <li>Excel básico (tablas, sumas, filtros).</li>
        <li>Redacción clara por WhatsApp y correo.</li>
        <li>Atención al público presencial.</li>
        <li>Castellano y guaraní: en atención y ventas es una ventaja real.</li>
        <li>Licencia de conducir, si la tenés.</li>
      </ul>
      <p>
        Para puestos de entrada, la <strong>disponibilidad</strong> muchas veces define la elección: si
        podés trabajar sábados o por turnos, decilo. Si estudiás, aclará en qué horario estás libre.
      </p>

      <h2 id="ejemplo">Ejemplo de CV sin experiencia</h2>
      <p>Adaptalo a tu caso, no lo copies tal cual:</p>
      <CvSheet cv={CV_EXAMPLES.sinExperiencia} />

      <h2 id="plantilla">Plantilla gratis para descargar</h2>
      <p>
        Este mismo ejemplo está listo para editar en Word. Reemplazá los datos por los tuyos y
        guardalo en PDF:
      </p>
      <CvTemplateDownloads only={['sin-experiencia']} />
      <p>
        Hay más modelos en <Link href={GUIDES.curriculumPlantillas.href}>plantillas de CV gratis</Link>.
      </p>

      <h2 id="errores">Errores que conviene evitar</h2>
      <ul>
        <li><strong>Inventar experiencia.</strong> Se nota en la primera pregunta de la entrevista.</li>
        <li><strong>Correo poco serio.</strong> Creá uno con tu nombre.</li>
        <li><strong>Foto informal.</strong> Tipo carnet, con fondo liso, o mejor sin foto.</li>
        <li><strong>El mismo CV para todo.</strong> Ajustá el perfil y el orden de las habilidades a cada aviso.</li>
      </ul>

      <h2 id="donde-postularte">Dónde postularte con tu primer CV</h2>
      <p>
        Un CV sin experiencia rinde más en los avisos correctos: los que dicen “sin experiencia”,
        “primer empleo” o “capacitación a cargo de la empresa”. Encontralos en{' '}
        <Link href="/trabajo-sin-experiencia">trabajos sin experiencia</Link> y{' '}
        <Link href="/trabajo-medio-tiempo">trabajos de medio tiempo</Link>, o por rubro en{' '}
        <Link href="/trabajo/atencion-al-cliente">atención al cliente</Link> y{' '}
        <Link href="/trabajo/ventas">ventas</Link>. Acompañalo con una{' '}
        <Link href={GUIDES.cartaPresentacion.href}>carta de presentación corta</Link>.
      </p>
    </GuidePage>
  );
}
