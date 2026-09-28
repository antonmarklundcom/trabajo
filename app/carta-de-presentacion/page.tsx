import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import { GUIDES } from '@/lib/guides';

// Keyword groups (PLAN-SEO.md §0): "carta de presentacion", "carta de
// presentacion ejemplo", "carta de presentacion laboral", "cartas de
// presentacion de cv", "carta de motivacion", "carta de presentación ejemplos
// cortos sin experiencia", "escrito de presentacion", "carta de presentacion
// de una empresa" (+ the misspellings "cara de presentacion", "carta de
// prese"). Copy adapted from content/blog-drafts/carta-de-presentacion-con-ejemplo.md.

const TITLE = 'Carta de presentación: cómo escribirla, con ejemplos cortos';
const DESCRIPTION =
  'Cómo hacer una carta de presentación para un trabajo en Paraguay: estructura, ejemplos para correo y WhatsApp, carta sin experiencia y carta de motivación.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.cartaPresentacion.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Qué es una carta de presentación?',
    a: 'Es un texto corto que acompaña tu curriculum y explica a qué puesto te postulás, quién sos y por qué encajás. Hoy suele ser el cuerpo del correo o el primer mensaje de WhatsApp.',
  },
  {
    q: '¿Cuánto tiene que medir una carta de presentación?',
    a: 'Entre cinco y diez líneas en un correo; tres o cuatro frases por WhatsApp. Una página entera casi nadie la lee.',
  },
  {
    q: '¿Es obligatorio mandar carta de presentación?',
    a: 'No, salvo que el aviso la pida. Pero un mensaje corto que nombre el puesto y diga por qué encajás casi siempre te pone por delante de quien manda solo el archivo.',
  },
  {
    q: '¿Qué diferencia hay entre carta de presentación y carta de motivación?',
    a: 'La carta de presentación se centra en tu experiencia y en por qué encajás en el puesto. La de motivación pone el foco en por qué querés ese trabajo, esa beca o esa carrera; se pide más en pasantías, becas y programas de formación.',
  },
];

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="not-prose my-5">
      <figcaption className="mb-2 text-sm font-semibold text-ink-secondary">{title}</figcaption>
      <div className="rounded-[10px] border border-border bg-white p-5 text-[15px] leading-relaxed text-ink space-y-3 shadow-card">
        {children}
      </div>
    </figure>
  );
}

export default function CartaPresentacionPage() {
  return (
    <GuidePage
      guideKey="cartaPresentacion"
      title="Carta de presentación: cómo escribirla, con ejemplos"
      description={DESCRIPTION}
      lede={
        <p>
          La carta de presentación es el texto corto que acompaña tu{' '}
          <Link href={GUIDES.curriculum.href} className="text-brand underline">curriculum vitae</Link>.
          Casi nunca es una carta en papel: es el cuerpo del correo o el primer mensaje de WhatsApp. Y
          por eso importa tanto: es lo primero que lee quien decide si te llama.
        </p>
      }
      toc={[
        { id: 'se-usa', label: '¿Se usa la carta de presentación en Paraguay?' },
        { id: 'estructura', label: 'Estructura en cuatro partes' },
        { id: 'ejemplo-correo', label: 'Ejemplo de carta de presentación por correo' },
        { id: 'ejemplo-whatsapp', label: 'Ejemplo corto para WhatsApp' },
        { id: 'sin-experiencia', label: 'Carta de presentación sin experiencia' },
        { id: 'motivacion', label: 'Carta de motivación' },
        { id: 'empresa', label: 'Carta de presentación de una empresa' },
        { id: 'errores', label: 'Lo que no conviene poner' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['curriculum', 'curriculumPlantillas', 'entrevista', 'curriculumSinExperiencia']}
    >
      <h2 id="se-usa">¿Se usa la carta de presentación en Paraguay?</h2>
      <p>
        Sí, pero no igual para todos los puestos. En empleos de oficina, profesionales y en
        postulaciones por correo, muchas empresas la esperan o la piden en el aviso. En puestos
        operativos y cuando te postulás por WhatsApp —la forma más común en Paraguay— la carta se
        convierte en un <strong>mensaje corto de presentación</strong>: tres o cuatro frases que
        acompañan el CV. En los dos casos cumple la misma función, y saltearla es la forma más fácil de
        quedar al fondo de la lista.
      </p>

      <h2 id="estructura">La estructura en cuatro partes</h2>
      <ol>
        <li><strong>Saludo y puesto.</strong> Nombrá el puesto exacto del aviso: a veces hay varios abiertos a la vez.</li>
        <li><strong>Quién sos, en una frase.</strong> Tu formación o tu experiencia más relevante para ese puesto.</li>
        <li><strong>Por qué vos.</strong> Una o dos cosas concretas que coinciden con lo que pide el aviso.</li>
        <li><strong>Cierre con disponibilidad.</strong> Que adjuntás el CV y cuándo podés tener una entrevista.</li>
      </ol>
      <p>Entre cinco y diez líneas alcanzan.</p>

      <h2 id="ejemplo-correo">Ejemplo de carta de presentación por correo</h2>
      <Example title="Carta de presentación laboral — por correo electrónico">
        <p><strong>Asunto:</strong> Postulación — Auxiliar administrativo/a</p>
        <p>Buenos días:</p>
        <p>Me postulo al puesto de Auxiliar administrativo/a publicado en trabajo.com.py.</p>
        <p>
          Soy estudiante de Contabilidad y trabajé un año como asistente en un estudio contable, donde
          cargaba facturas, preparaba planillas en Excel y atendía consultas de clientes por teléfono.
        </p>
        <p>
          El aviso pide orden con la documentación y manejo de Excel: son justamente las tareas que
          hacía todos los días.
        </p>
        <p>Adjunto mi CV. Tengo disponibilidad para una entrevista cualquier día de esta semana, de mañana.</p>
        <p>Saludos cordiales,<br />Juan Benítez — 09XX XXX XXX</p>
      </Example>

      <h2 id="ejemplo-whatsapp">Ejemplo corto para WhatsApp</h2>
      <Example title="Breve presentación para acompañar el CV por WhatsApp">
        <p>
          Hola, buenas tardes. Me llamo Juan Benítez y me interesa el puesto de Auxiliar
          administrativo/a que vi en trabajo.com.py. Tengo un año de experiencia como asistente en un
          estudio contable (facturas, Excel, atención telefónica). Te paso mi CV en PDF. ¡Gracias!
        </p>
      </Example>
      <p>
        Es la misma carta, comprimida. No mandes solo “Hola, me interesa” y el archivo.
      </p>

      <h2 id="sin-experiencia">Carta de presentación sin experiencia</h2>
      <p>
        Cuando no tenés trabajos previos, la carta es todavía más útil: te deja explicar lo que el CV
        no muestra. Hablá de tu formación, de alguna tarea práctica y de tu disponibilidad.
      </p>
      <Example title="Ejemplo corto sin experiencia">
        <p>
          Buenos días. Me postulo al puesto de Cajero/a. Terminé el bachillerato técnico en Informática
          y busco mi primer empleo. Durante dos años ayudé en el local de celulares de mi familia con la
          atención y el cobro. Puedo trabajar de lunes a sábado y vivo en Luque. Adjunto mi CV.
          ¡Gracias por su tiempo!
        </p>
      </Example>
      <p>
        Si también estás armando el CV, seguí la guía de{' '}
        <Link href={GUIDES.curriculumSinExperiencia.href}>CV sin experiencia</Link>.
      </p>

      <h2 id="motivacion">Carta de motivación</h2>
      <p>
        La carta de motivación pone el foco en <em>por qué</em> querés ese puesto, esa pasantía o esa
        beca: qué te atrae de la organización y qué querés aprender. Mantené la misma estructura, pero
        dedicá el párrafo central a tu motivación con un ejemplo concreto (un proyecto, una materia, una
        experiencia) en lugar de frases generales.
      </p>

      <h2 id="empresa">Carta de presentación de una empresa</h2>
      <p>
        Cuando la que se presenta es una empresa —para ofrecer servicios a un posible cliente—, la
        lógica es la misma: quiénes son, qué problema resuelven y un siguiente paso concreto (una
        reunión, un presupuesto). Media página, con datos de contacto claros. Y si lo que tu empresa
        necesita es sumar gente, podés <Link href="/publicar">publicar una oferta de empleo</Link>.
      </p>

      <h2 id="errores">Lo que no conviene poner</h2>
      <ul>
        <li><strong>Frases genéricas</strong> como “soy responsable y proactivo”: no se pueden comprobar.</li>
        <li><strong>Pretensión salarial</strong>, salvo que el aviso la pida: eso se habla en la entrevista.</li>
        <li><strong>Tu vida entera:</strong> solo lo que sirve para ese puesto.</li>
        <li><strong>La misma carta para todo:</strong> si nombra el puesto equivocado, es peor que no mandarla.</li>
        <li><strong>Errores en el nombre de la empresa o del puesto:</strong> revisalo dos veces.</li>
      </ul>
      <p>
        Con la carta lista, buscá tu próximo empleo entre las{' '}
        <Link href="/empleos">ofertas de trabajo en Paraguay</Link> y prepará la{' '}
        <Link href={GUIDES.entrevista.href}>entrevista</Link>.
      </p>
    </GuidePage>
  );
}
