import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import CvSheet from '@/components/guide/CvSheet';
import { CV_EXAMPLES } from '@/lib/cv-examples';
import { GUIDES } from '@/lib/guides';

// Keyword groups served here (PLAN-SEO.md §1): "curriculum vitae",
// "currículum", "como hacer un curriculum", "como hacer curriculum vitae",
// "como crear un cv", "curriculum vitae ejemplos", "ejemplo de cv",
// "curriculum de modelos", "curriculum vitae modelo", "formato de curriculum
// vitae", "curriculo vitae basico", "cv sencillo", "curriculum cronologico".
// The download intent ("gratis", "plantilla", "word", "pdf") is its own page,
// /curriculum-vitae/plantillas, and "sin experiencia" is /sin-experiencia.

const TITLE = 'Curriculum vitae: cómo hacer un CV en Paraguay, con ejemplos';
const DESCRIPTION =
  'Cómo hacer un curriculum vitae paso a paso para trabajar en Paraguay: qué datos poner, formato, tipos de CV, ejemplos y plantillas gratis en Word y PDF.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.curriculum.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Qué es un curriculum vitae?',
    a: 'Es el documento en el que resumís tus datos de contacto, tu experiencia laboral, tu formación y tus habilidades para postularte a un empleo. “Curriculum vitae”, “currículum” y “CV” son la misma cosa.',
  },
  {
    q: '¿Cuántas hojas tiene que tener un curriculum?',
    a: 'Una página alcanza para la gran mayoría de los perfiles, sobre todo con menos de diez años de experiencia. Dos páginas como máximo si tu trayectoria lo justifica.',
  },
  {
    q: '¿Hay que poner foto en el curriculum en Paraguay?',
    a: 'No es obligatorio, pero es muy común y muchos empleadores la esperan, sobre todo en atención al público. Si la ponés, que sea tipo carnet, con buena luz y fondo liso.',
  },
  {
    q: '¿Pongo mi número de cédula en el CV?',
    a: 'En Paraguay es habitual y muchos avisos lo piden. Ponelo cuando te postulás a una empresa que conocés o cuando el aviso lo pide; si no sabés quién recibe tu CV, es más seguro dejarlo para la entrevista.',
  },
  {
    q: '¿En qué formato mando el curriculum?',
    a: 'En PDF, con tu nombre en el archivo (por ejemplo, CV-Maria-Gonzalez.pdf). Así no se desarma al abrirlo en el celular, que es donde la mayoría de los reclutadores lo va a leer.',
  },
  {
    q: '¿Qué documentos piden junto con el curriculum?',
    a: 'Para muchos puestos en Paraguay te van a pedir fotocopia de cédula, certificado de antecedentes policiales y certificado de estudios; según el rubro, también licencia de conducir o carnet de salud. Tenelos listos antes de la entrevista.',
  },
];

export default function CurriculumPage() {
  return (
    <GuidePage
      guideKey="curriculum"
      title="Curriculum vitae: cómo hacer un CV para trabajar en Paraguay"
      description={DESCRIPTION}
      crumbLabel="Curriculum vitae"
      lede={
        <p>
          Tu curriculum vitae es lo primero que una empresa ve de vos. Esta guía te muestra cómo hacer
          un CV paso a paso, qué datos se acostumbran en Paraguay, qué formato usar y cómo se ve un buen
          curriculum con ejemplos reales. Si preferís empezar de una plantilla, tenés{' '}
          <Link href={GUIDES.curriculumPlantillas.href} className="text-brand underline">
            modelos de CV gratis en Word y PDF
          </Link>
          .
        </p>
      }
      toc={[
        { id: 'que-es', label: 'Qué es un curriculum vitae' },
        { id: 'paso-a-paso', label: 'Cómo hacer un curriculum paso a paso' },
        { id: 'paraguay', label: 'Qué datos se ponen en un CV en Paraguay' },
        { id: 'formato', label: 'Formato de curriculum vitae' },
        { id: 'tipos', label: 'Tipos de CV: cronológico, funcional y combinado' },
        { id: 'ejemplos', label: 'Ejemplos de curriculum vitae' },
        { id: 'basico', label: 'CV básico o sencillo: cuándo conviene' },
        { id: 'enviar', label: 'Cómo mandar tu CV por WhatsApp o correo' },
        { id: 'errores', label: 'Errores que te dejan afuera' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['curriculumPlantillas', 'curriculumSinExperiencia', 'cartaPresentacion', 'entrevista']}
    >
      <h2 id="que-es">Qué es un curriculum vitae</h2>
      <p>
        El curriculum vitae (en latín, “recorrido de vida”) es un documento corto que resume quién
        sos, qué sabés hacer y dónde trabajaste o estudiaste. <strong>Currículum, CV y curriculum
        vitae son lo mismo</strong>: las empresas los usan como sinónimos. Su objetivo no es contar
        toda tu historia, sino conseguir que te llamen para una entrevista.
      </p>
      <p>
        Un reclutador suele mirar cada CV menos de un minuto. Por eso un buen curriculum es claro,
        ordenado y va directo a lo que el puesto necesita.
      </p>

      <h2 id="paso-a-paso">Cómo hacer un curriculum paso a paso</h2>
      <ol>
        <li>
          <strong>Leé el aviso antes de escribir.</strong> Anotá lo que piden (experiencia, sistemas,
          horarios, zona) y usá esas mismas palabras en tu CV cuando sean ciertas para vos.
        </li>
        <li>
          <strong>Datos de contacto arriba de todo:</strong> nombre y apellido, ciudad y barrio,
          teléfono con WhatsApp y un correo serio (nombre.apellido@…).
        </li>
        <li>
          <strong>Un perfil de dos o tres líneas:</strong> qué hacés, en qué rubro tenés experiencia y
          qué puesto buscás. Evitá frases que podría escribir cualquiera, como “proactivo y
          responsable”.
        </li>
        <li>
          <strong>Experiencia laboral, de la más reciente a la más antigua:</strong> empresa, cargo,
          mes y año de inicio y fin, y dos o tres tareas o logros concretos.
        </li>
        <li>
          <strong>Formación:</strong> colegio, instituto o universidad, título y año (o “en curso”).
          Los cursos cortos van en una sección aparte.
        </li>
        <li>
          <strong>Habilidades concretas:</strong> sistemas y programas, manejo de caja, licencia de
          conducir, redes sociales. Lo que se pueda comprobar.
        </li>
        <li>
          <strong>Idiomas:</strong> castellano, guaraní y, si aplica, portugués o inglés con tu nivel
          real. En atención al público, hablar guaraní es una ventaja.
        </li>
        <li>
          <strong>Referencias:</strong> dos personas que puedan hablar de tu trabajo, con cargo y
          teléfono (avisales antes).
        </li>
        <li>
          <strong>Revisá y guardá en PDF.</strong> Pedile a alguien que lo lea buscando errores de
          ortografía.
        </li>
      </ol>

      <h2 id="paraguay">Qué datos se ponen en un CV en Paraguay</h2>
      <p>
        El curriculum paraguayo tiene algunas costumbres propias que conviene conocer, porque los
        empleadores las esperan:
      </p>
      <ul>
        <li>
          <strong>Foto tipo carnet.</strong> No es obligatoria, pero es habitual, sobre todo en
          atención al público, ventas y recepción. Fondo liso y buena luz; nada de fotos recortadas
          de redes sociales.
        </li>
        <li>
          <strong>Datos personales.</strong> Muchos CV incluyen número de cédula, fecha de nacimiento
          y estado civil. No son necesarios para evaluar tu perfil: ponelos si el aviso los pide o si
          conocés a la empresa. Tu dirección puede ser solo barrio y ciudad.
        </li>
        <li>
          <strong>Ciudad y zona.</strong> Para puestos presenciales, que la empresa vea que vivís cerca
          (por ejemplo, “Luque” o “San Lorenzo”) suma, porque los traslados en Gran Asunción pesan.
        </li>
        <li>
          <strong>Referencias.</strong> En Paraguay es común incluir referencias laborales o
          personales con nombre y teléfono, o al menos la línea “Referencias disponibles a pedido”.
        </li>
        <li>
          <strong>Idiomas locales.</strong> Guaraní para atención al público; portugués si buscás
          trabajo en Ciudad del Este o en zonas de frontera.
        </li>
      </ul>
      <p>
        Además del CV, para muchos puestos te van a pedir una “carpeta” con documentos:{' '}
        <strong>fotocopia de cédula, certificado de antecedentes policiales, certificado de
        estudios</strong> y, según el rubro, licencia de conducir o carnet de salud. Tenerlos listos
        te ahorra días entre la entrevista y el primer día de trabajo.
      </p>
      <blockquote>
        <p>
          Cuidá tus datos: si un aviso te pide plata, fotos de tu cédula o códigos por WhatsApp antes
          de una entrevista, desconfiá.
        </p>
      </blockquote>

      <h2 id="formato">Formato de curriculum vitae</h2>
      <p>El formato de CV que mejor funciona es simple:</p>
      <ul>
        <li><strong>Una página</strong> (dos como máximo con mucha experiencia).</li>
        <li>Letra legible como Arial o Calibri, de 10 a 12 puntos; títulos de sección en negrita.</li>
        <li>Márgenes normales y espacio entre secciones: un CV amontonado no se lee.</li>
        <li>Sin colores fuertes, marcos ni gráficos de “nivel de habilidad” en barritas.</li>
        <li>
          <strong>Guardado en PDF</strong> con tu nombre en el archivo. En Word, usá “Guardar como →
          PDF”; en el celular, “Compartir → Imprimir → Guardar como PDF”.
        </li>
      </ul>
      <p>
        El orden de las secciones es: datos de contacto, perfil, experiencia laboral, formación,
        cursos, habilidades, idiomas y referencias. Si no tenés experiencia, pasá la formación arriba
        (ver <Link href={GUIDES.curriculumSinExperiencia.href}>CV sin experiencia</Link>).
      </p>

      <h2 id="tipos">Tipos de CV: cronológico, funcional y combinado</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Cómo se ordena</th>
              <th scope="col">Para quién</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Cronológico</strong></td>
              <td>La experiencia, de la más reciente a la más antigua.</td>
              <td>Quien tiene experiencia continua en el mismo rubro. Es el más usado en Paraguay.</td>
            </tr>
            <tr>
              <td><strong>Funcional</strong></td>
              <td>Por habilidades y experiencia práctica, no por fechas.</td>
              <td>Primer empleo, cambio de rubro o períodos sin trabajo formal.</td>
            </tr>
            <tr>
              <td><strong>Combinado</strong></td>
              <td>Un bloque de habilidades clave y después la experiencia por fechas.</td>
              <td>Perfiles con experiencia variada que quieren destacar lo que sirve para el puesto.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="ejemplos">Ejemplos de curriculum vitae</h2>
      <p>
        Tres modelos de curriculum para situaciones distintas. Usalos como guía para el orden y el
        tono; los datos son inventados.
      </p>
      <CvSheet cv={CV_EXAMPLES.administrativo} />
      <p>
        Fijate que cada experiencia describe tareas concretas (“emisión de facturas”, “conciliación de
        cuentas”) en lugar de adjetivos. Eso es lo que un reclutador busca en los primeros segundos.
      </p>
      <CvSheet cv={CV_EXAMPLES.chofer} />
      <p>
        Para puestos operativos, lo que más pesa son los documentos al día y la zona que conocés: el
        CV puede ser corto, pero tiene que decir eso claramente. El ejemplo de CV sin experiencia está
        en la guía de <Link href={GUIDES.curriculumSinExperiencia.href}>curriculum sin experiencia</Link>.
      </p>

      <h2 id="basico">CV básico o sencillo: cuándo conviene</h2>
      <p>
        Un curriculum vitae básico —datos, perfil, experiencia, estudios y referencias en una sola
        hoja— es lo que mejor funciona para la mayoría de los empleos en Paraguay: cajeros, vendedores,
        choferes, auxiliares, personal de limpieza o de cocina. No necesitás un diseño llamativo; un
        CV sencillo y prolijo transmite orden. Podés descargar el{' '}
        <Link href={GUIDES.curriculumPlantillas.href}>CV básico en Word</Link> y completarlo en diez
        minutos.
      </p>
      <p>
        Un CV con más diseño solo suma en rubros creativos (diseño, marketing), y aun ahí el contenido
        pesa más que los colores.
      </p>

      <h2 id="enviar">Cómo mandar tu CV por WhatsApp o correo</h2>
      <p>
        En Paraguay, muchas postulaciones empiezan por WhatsApp. Mandá el CV en PDF junto con un
        mensaje corto que diga a qué puesto te postulás y por qué te interesa: ese mensaje cumple el
        papel de la <Link href={GUIDES.cartaPresentacion.href}>carta de presentación</Link>. Por
        correo, poné el puesto en el asunto (“Postulación — Auxiliar administrativo”) y escribí tres o
        cuatro líneas en el cuerpo.
      </p>
      <p>
        En trabajo.com.py te postulás gratis a cada <Link href="/empleos">oferta de trabajo</Link>{' '}
        escribiendo directo a la empresa por WhatsApp, o con el formulario del aviso.
      </p>

      <h2 id="errores">Errores que te dejan afuera</h2>
      <ul>
        <li>Errores de ortografía o un correo informal (“lokito2005@…”).</li>
        <li>Mandar el mismo CV a todos los avisos sin adaptar el perfil.</li>
        <li>Inventar experiencia: se nota en la primera pregunta de la entrevista.</li>
        <li>Un teléfono mal escrito o que no atendés.</li>
        <li>Mandarlo en una foto o en un archivo de Word que se desarma en el celular.</li>
      </ul>
      <p>
        Con el CV listo, prepará la <Link href={GUIDES.entrevista.href}>entrevista de trabajo</Link>{' '}
        y mirá las ofertas por ciudad, como el{' '}
        <Link href="/trabajo-en/asuncion">trabajo en Asunción</Link>.
      </p>
    </GuidePage>
  );
}
