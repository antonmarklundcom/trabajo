import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import CvTemplateDownloads from '@/components/guide/CvTemplateDownloads';
import { GUIDES } from '@/lib/guides';

// Keyword groups served here (PLAN-SEO.md §0) — the download intent:
// "curriculum vitae gratis", "curriculum vitae en pdf gratis", "plantilla de
// curriculum vitae", "plantilla para cv", "plantillas de cv creativos gratis
// word", "plantillas para curriculum gratis", "modelo de currículum vitae en
// word para editar", "cv gratuitos", "curriculum vitae para llenar",
// "currículum vitae pdf para llenar", "curriculum vitae online gratis".

const TITLE = 'Plantillas de curriculum vitae gratis en Word y PDF para llenar';
const DESCRIPTION =
  'Descargá gratis modelos de curriculum vitae en Word para editar y en PDF para llenar: CV básico, CV sin experiencia y formulario para imprimir. Adaptados a Paraguay.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.curriculumPlantillas.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Las plantillas de CV son gratis?',
    a: 'Sí. Podés descargarlas, editarlas y usarlas todas las veces que quieras, sin registrarte.',
  },
  {
    q: '¿Cómo edito la plantilla de CV en el celular?',
    a: 'Abrí el archivo .docx con Word para Android o iPhone, Google Docs o WPS Office, reemplazá el texto entre corchetes y exportalo como PDF desde el menú Compartir o Descargar.',
  },
  {
    q: '¿Qué plantilla de curriculum uso si nunca trabajé?',
    a: 'La plantilla de CV sin experiencia: pone la formación y la experiencia práctica (changas, negocio familiar, voluntariado) antes que el empleo formal.',
  },
  {
    q: '¿Puedo llenar el curriculum a mano?',
    a: 'Sí. El curriculum vitae para llenar está pensado para imprimir y completar con letra clara, por ejemplo para dejar tu carpeta en persona. Para postularte por WhatsApp o correo, conviene la versión digital en PDF.',
  },
];

export default function PlantillasPage() {
  return (
    <GuidePage
      guideKey="curriculumPlantillas"
      title="Plantillas de curriculum vitae gratis (Word y PDF)"
      description={DESCRIPTION}
      parents={[{ label: 'Curriculum vitae', href: GUIDES.curriculum.href }]}
      crumbLabel="Plantillas"
      lede={
        <p>
          Tres modelos de curriculum vitae listos para descargar: editalos en Word, guardalos en PDF y
          mandalos por WhatsApp o correo. Están pensados para cómo se contrata en Paraguay: con
          espacio para foto, idiomas (incluido el guaraní) y referencias.
        </p>
      }
      hero={<CvTemplateDownloads />}
      toc={[
        { id: 'como-usar', label: 'Cómo usar la plantilla en Word' },
        { id: 'celular', label: 'Cómo hacer el CV desde el celular' },
        { id: 'para-llenar', label: 'Curriculum vitae en PDF para llenar' },
        { id: 'cual-elegir', label: 'Qué modelo de CV elegir' },
        { id: 'antes-de-enviar', label: 'Antes de mandarlo: checklist' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['curriculum', 'curriculumSinExperiencia', 'cartaPresentacion', 'entrevista']}
    >
      <h2 id="como-usar">Cómo usar la plantilla de CV en Word</h2>
      <ol>
        <li>Descargá el archivo <strong>.docx</strong> y abrilo con Word, Google Docs o LibreOffice.</li>
        <li>
          Reemplazá todo lo que está <strong>[entre corchetes]</strong> con tus datos. Si una sección
          no te sirve (por ejemplo, cursos), borrala entera.
        </li>
        <li>
          Si ponés foto, reemplazá el recuadro por una foto tipo carnet: en Word, clic en el recuadro →
          Insertar → Imágenes.
        </li>
        <li>Revisá que todo entre en una página.</li>
        <li>
          Guardalo en PDF: Archivo → Guardar como → PDF. Poné tu nombre en el archivo, por ejemplo
          CV-Juan-Perez.pdf.
        </li>
      </ol>

      <h2 id="celular">Cómo hacer el curriculum desde el celular</h2>
      <p>
        No necesitás computadora. Instalá Word, Google Docs o WPS Office (son gratis), abrí la
        plantilla descargada y editá el texto. Para exportar en PDF, buscá la opción “Compartir”,
        “Descargar como PDF” o “Imprimir → Guardar como PDF”, según la aplicación. Después lo podés
        mandar directo por WhatsApp.
      </p>
      <p>
        Si usás una herramienta de diseño online para armar un CV más visual, aplicá las mismas reglas:
        una página, letra legible y exportado en PDF. El diseño nunca reemplaza al contenido.
      </p>

      <h2 id="para-llenar">Curriculum vitae en PDF para llenar</h2>
      <p>
        El <strong>curriculum vitae para llenar</strong> es un formulario con líneas: datos personales,
        perfil, experiencia, formación, habilidades, idiomas y referencias. Imprimilo y completalo con
        letra de imprenta clara, en birome azul o negra. Sirve cuando una empresa pide dejar la
        carpeta en persona o cuando todavía no tenés dónde editar un archivo.
      </p>

      <h2 id="cual-elegir">Qué modelo de CV elegir</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Tu situación</th>
              <th scope="col">Plantilla recomendada</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tenés experiencia en el mismo rubro</td>
              <td>CV básico (cronológico)</td>
            </tr>
            <tr>
              <td>Buscás tu primer empleo o sos estudiante</td>
              <td>CV sin experiencia</td>
            </tr>
            <tr>
              <td>Tenés que dejar el CV impreso o completarlo a mano</td>
              <td>Curriculum vitae para llenar</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        ¿Querés ver cómo queda completo? Mirá los{' '}
        <Link href={`${GUIDES.curriculum.href}#ejemplos`}>ejemplos de curriculum vitae</Link> y la guía
        de <Link href={GUIDES.curriculum.href}>cómo hacer un curriculum paso a paso</Link>.
      </p>

      <h2 id="antes-de-enviar">Antes de mandarlo: checklist</h2>
      <ul>
        <li>Entra en una página y no quedó ningún [corchete] sin reemplazar.</li>
        <li>Tu teléfono y tu correo están bien escritos (probalos).</li>
        <li>El perfil dice a qué puesto te postulás.</li>
        <li>Está en PDF y el archivo lleva tu nombre.</li>
        <li>Alguien de confianza lo leyó buscando errores.</li>
        <li>Tenés lista una <Link href={GUIDES.cartaPresentacion.href}>carta de presentación</Link> o un mensaje corto para acompañarlo.</li>
      </ul>
      <p>
        Cuando lo tengas, buscá entre las <Link href="/empleos">ofertas de trabajo en Paraguay</Link> y
        postulate gratis.
      </p>
    </GuidePage>
  );
}
