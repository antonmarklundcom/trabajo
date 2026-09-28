import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import { GUIDES } from '@/lib/guides';

// Keyword groups (PLAN-SEO.md §1): "preguntas de entrevista de trabajo",
// "entrevista en ingles", "10 consejos para una entrevista de trabajo",
// "5 fortalezas y 5 debilidades en una entrevista ejemplos", and the
// "porque quieres trabajar con nosotros como responder" tail of the
// "trabaja con nosotros" group. Copy adapted from
// content/blog-drafts/preguntas-frecuentes-en-una-entrevista-de-trabajo.md and
// entrevista-por-videollamada-o-whatsapp.md.

const TITLE = 'Preguntas de entrevista de trabajo y cómo responderlas';
const DESCRIPTION =
  'Las preguntas más frecuentes en una entrevista de trabajo en Paraguay, qué quieren saber y cómo responder: fortalezas y debilidades con ejemplos, entrevista en inglés y consejos.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.entrevista.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Qué preguntan en una entrevista de trabajo?',
    a: 'Casi siempre: que te presentes, por qué querés trabajar ahí, tus fortalezas y debilidades, una situación difícil que resolviste, por qué dejaste tu último trabajo, cuánto pretendés ganar y tu disponibilidad.',
  },
  {
    q: '¿Cómo respondo “por qué deberíamos contratarte”?',
    a: 'Uní dos o tres requisitos del aviso con ejemplos concretos de tu experiencia o formación, y cerrá con tu disponibilidad o tus ganas de aprender el puesto.',
  },
  {
    q: '¿Qué llevo a una entrevista de trabajo?',
    a: 'Tu CV impreso, cédula, una birome y, si te los pidieron, los documentos de la carpeta (antecedentes policiales, certificado de estudios). Llegá diez minutos antes.',
  },
];

export default function EntrevistaPage() {
  return (
    <GuidePage
      guideKey="entrevista"
      title="Preguntas de entrevista de trabajo y cómo responderlas"
      description={DESCRIPTION}
      crumbLabel="Entrevista de trabajo"
      lede={
        <p>
          Cada entrevista es distinta, pero hay preguntas que aparecen casi siempre, sea para un local
          de ventas o para una oficina. Si las pensaste antes, llegás más tranquilo/a y respondés
          mejor. La idea no es memorizar respuestas —eso se nota— sino saber qué querés contar en cada
          caso.
        </p>
      }
      toc={[
        { id: 'preguntas', label: 'Las preguntas más frecuentes' },
        { id: 'fortalezas-debilidades', label: '5 fortalezas y 5 debilidades: ejemplos' },
        { id: 'por-que-nosotros', label: '¿Por qué querés trabajar con nosotros?' },
        { id: 'tus-preguntas', label: 'Qué preguntar vos al final' },
        { id: 'whatsapp-videollamada', label: 'Entrevista por WhatsApp o videollamada' },
        { id: 'ingles', label: 'Entrevista en inglés' },
        { id: 'consejos', label: '10 consejos para una entrevista de trabajo' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['curriculum', 'cartaPresentacion', 'curriculumPlantillas', 'salarioMinimo']}
    >
      <h2 id="preguntas">Las preguntas más frecuentes en una entrevista laboral</h2>
      <p>
        Para cada pregunta, pensá primero <strong>qué quiere saber</strong> quien entrevista. Eso te
        ayuda a no irte por las ramas.
      </p>

      <h3>1. “Contame un poco de vos”</h3>
      <p>
        <strong>Qué quieren saber:</strong> si te presentás en forma ordenada y si tu perfil tiene que
        ver con el puesto. <strong>Cómo responder:</strong> un minuto, en orden presente → pasado →
        futuro. Ejemplo: “Hoy estudio Administración de noche. Durante dos años trabajé en atención al
        público en una farmacia, con caja y reclamos. Me interesa este puesto porque quiero seguir en
        atención al cliente en una empresa más grande.”
      </p>

      <h3>2. “¿Por qué querés trabajar acá?”</h3>
      <p>
        Quieren saber si leíste el aviso y averiguaste algo de la empresa. Nombrá algo concreto del
        puesto o de la empresa (mirá su sitio o sus redes antes). Evitá “porque necesito trabajo”.
      </p>

      <h3>3. “¿Por qué deberíamos contratarte?”</h3>
      <p>
        Uní dos requisitos del aviso con dos ejemplos tuyos: “Piden manejo de caja y atención al
        público: hice las dos cosas durante dos años en el negocio familiar, y puedo trabajar los
        sábados.”
      </p>

      <h3>4. “Contame una situación difícil con un cliente o un compañero”</h3>
      <p>
        Usá el orden <strong>situación → qué hiciste → cómo terminó</strong>. Un caso real, sin hablar
        mal de nadie, enfocado en lo que hiciste vos.
      </p>

      <h3>5. “¿Por qué dejaste tu último trabajo?”</h3>
      <p>
        Corto y sin críticas: “terminó el contrato”, “buscaba un horario compatible con la facultad”,
        “quiero crecer en otra área”. Si te despidieron, decilo con calma y contá qué aprendiste.
      </p>

      <h3>6. “¿Dónde te ves en unos años?”</h3>
      <p>Mostrá interés en crecer dentro del área. No hace falta un plan detallado.</p>

      <h3>7. “¿Cuánto pretendés ganar?”</h3>
      <p>
        Si el aviso publica un rango, tomalo de referencia. Si no, preguntá primero cuál es el rango
        previsto. Conviene conocer el <Link href={GUIDES.salarioMinimo.href}>salario mínimo vigente</Link>{' '}
        y lo que suele pagarse en el rubro.
      </p>

      <h3>8. “¿Qué disponibilidad tenés?”</h3>
      <p>
        Horarios, sábados, turnos, cuándo podés empezar: respondé con la verdad. Prometer
        disponibilidad que no tenés termina mal para las dos partes.
      </p>

      <h2 id="fortalezas-debilidades">5 fortalezas y 5 debilidades en una entrevista: ejemplos</h2>
      <p>
        Elegí dos fortalezas que sirvan para el puesto y acompañá cada una con un ejemplo. Para la
        debilidad, una real que no sea central para el puesto, y qué estás haciendo para mejorarla.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Fortaleza</th>
              <th scope="col">Cómo decirla con un ejemplo</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Organización</td><td>“Armé una planilla para controlar los pedidos y dejamos de perder entregas.”</td></tr>
            <tr><td>Trato con clientes</td><td>“En la farmacia me pedían para los reclamos difíciles porque mantenía la calma.”</td></tr>
            <tr><td>Aprendo rápido</td><td>“En dos semanas aprendí el sistema de facturación y empecé a capacitar a otros.”</td></tr>
            <tr><td>Responsabilidad con el dinero</td><td>“Cerré caja todos los días durante dos años sin faltantes.”</td></tr>
            <tr><td>Trabajo en equipo</td><td>“Cubría turnos de compañeros en temporada alta y nos organizábamos por WhatsApp.”</td></tr>
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Debilidad</th>
              <th scope="col">Qué estás haciendo para mejorarla</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Me cuesta hablar en público</td><td>“Me anoto para presentar en la facultad para practicar.”</td></tr>
            <tr><td>Poco manejo de Excel</td><td>“Estoy haciendo un curso en línea de Excel intermedio.”</td></tr>
            <tr><td>Me cuesta delegar</td><td>“Estoy aprendiendo a repartir tareas y confiar en el equipo.”</td></tr>
            <tr><td>Soy impaciente con las demoras</td><td>“Anoto los plazos y hago seguimiento en lugar de apurar a otros.”</td></tr>
            <tr><td>Nivel básico de inglés</td><td>“Practico con una aplicación todos los días.”</td></tr>
          </tbody>
        </table>
      </div>
      <p>Evitá la respuesta trillada “soy muy perfeccionista”: suena preparada.</p>

      <h2 id="por-que-nosotros">¿Por qué querés trabajar con nosotros? Cómo responder</h2>
      <p>
        Es la versión directa de “¿por qué te interesa esta empresa?”. Una buena respuesta tiene tres
        partes: algo concreto que sabés de la empresa (lo que venden, cómo atienden, que están
        creciendo), lo que te atrae del puesto y cómo encaja con lo que ya sabés hacer. Ejemplo: “Compro
        en sus locales y siempre me llamó la atención la atención al cliente. Tengo experiencia en caja
        y me gustaría crecer en una empresa que cuida eso.”
      </p>

      <h2 id="tus-preguntas">Qué preguntar vos al final</h2>
      <ul>
        <li>¿Cómo es un día normal en este puesto?</li>
        <li>¿Con quién voy a trabajar y a quién le reporto?</li>
        <li>¿Hay capacitación al inicio?</li>
        <li>¿Cómo sigue el proceso y cuándo tendrían una respuesta?</li>
      </ul>

      <h2 id="whatsapp-videollamada">Entrevista por WhatsApp o videollamada</h2>
      <p>
        Cada vez más entrevistas empiezan por WhatsApp o por videollamada. Probá la cámara y el audio
        antes, buscá un lugar tranquilo con luz de frente, vestite como para una entrevista presencial
        y tené tu CV abierto. Por WhatsApp, respondé en horario razonable, con frases completas y sin
        audios largos, salvo que te los pidan.
      </p>

      <h2 id="ingles">Entrevista en inglés: preguntas comunes</h2>
      <p>
        Algunas empresas —sobre todo de tecnología, call centers para el exterior y multinacionales—
        hacen parte de la entrevista en inglés. Las preguntas son las mismas:
      </p>
      <ul>
        <li><em>Tell me about yourself.</em> — Contame de vos.</li>
        <li><em>Why do you want to work here?</em> — ¿Por qué querés trabajar acá?</li>
        <li><em>What are your strengths and weaknesses?</em> — Fortalezas y debilidades.</li>
        <li><em>Describe a difficult situation and how you handled it.</em> — Una situación difícil.</li>
        <li><em>Where do you see yourself in five years?</em> — Dónde te ves en cinco años.</li>
      </ul>
      <p>
        Prepará tus respuestas en voz alta y en frases simples: se valora más la claridad que el
        vocabulario. Si no entendiste algo, pedí que lo repitan (<em>Could you repeat that, please?</em>).
      </p>

      <h2 id="consejos">10 consejos para una entrevista de trabajo</h2>
      <ol>
        <li>Leé el aviso otra vez antes de ir y anotá qué piden.</li>
        <li>Averiguá qué hace la empresa.</li>
        <li>Practicá tu presentación de un minuto en voz alta.</li>
        <li>Prepará dos ejemplos concretos de logros o situaciones resueltas.</li>
        <li>Llegá diez minutos antes (calculá bien el colectivo).</li>
        <li>Llevá tu CV impreso, cédula y los documentos que te pidieron.</li>
        <li>Vestite un poco más formal que el día a día del puesto.</li>
        <li>Escuchá la pregunta completa antes de responder.</li>
        <li>No hables mal de empleadores anteriores.</li>
        <li>Al día siguiente, mandá un mensaje corto agradeciendo la entrevista.</li>
      </ol>
      <p>
        Más consejos en{' '}
        <Link href="/blog/como-prepararte-para-una-entrevista">cómo prepararte para una entrevista</Link>. Y
        si todavía estás buscando dónde postularte, mirá las{' '}
        <Link href="/empleos">ofertas de trabajo publicadas hoy</Link>.
      </p>
    </GuidePage>
  );
}
