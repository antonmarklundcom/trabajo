import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import { GUIDES } from '@/lib/guides';
import { gs, SALARIO_MINIMO } from '@/lib/labor-law';

// Keyword groups (PLAN-SEO.md §1): "contrato de trabajo paraguay modelo",
// "modelo de contrato de trabajo en word paraguay", "contrato de trabajo
// paraguay", "contrato individual de trabajo paraguay", "contrato laboral
// paraguay", "contrato de trabajo paraguay pdf". The page most aimed at
// employers: a small business about to hire lands here, then on /publicar.

const TITLE = 'Modelo de contrato de trabajo en Paraguay (Word, gratis)';
const DESCRIPTION =
  'Modelo de contrato individual de trabajo para Paraguay en Word, gratis: qué debe incluir, tipos de contrato, período de prueba e inscripción en IPS y MTESS.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.contrato.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿El contrato de trabajo tiene que ser por escrito?',
    a: 'La ley admite el contrato verbal en algunos casos, pero lo recomendable siempre es hacerlo por escrito, en dos ejemplares firmados: protege a las dos partes y deja claros el cargo, el horario y el salario.',
  },
  {
    q: '¿Cuánto dura el período de prueba?',
    a: 'Hasta 30 días para trabajadores no calificados y personal doméstico, y hasta 60 días para trabajadores calificados o aprendices (art. 58 del Código del Trabajo). Para puestos técnicos muy especializados, las partes pueden acordar otro plazo.',
  },
  {
    q: '¿Hay que inscribir al trabajador en el IPS?',
    a: 'Sí, desde el inicio de la relación laboral. El empleador aporta el 16,5 % y retiene el 9 % del salario del trabajador. También corresponde el registro obrero-patronal ante el Ministerio de Trabajo (MTESS).',
  },
];

export default function ContratoPage() {
  return (
    <GuidePage
      guideKey="contrato"
      title="Modelo de contrato de trabajo en Paraguay"
      description={DESCRIPTION}
      crumbLabel="Contrato de trabajo"
      lede={
        <p>
          Un contrato individual de trabajo claro evita la mayoría de los conflictos laborales. Acá
          tenés un <strong className="text-ink">modelo de contrato de trabajo en Word</strong>, gratis
          y listo para adaptar, y una explicación de qué tiene que incluir según el Código del Trabajo
          (Ley N.º 213/93).
        </p>
      }
      hero={
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="font-bold text-ink">Modelo de contrato individual de trabajo</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Diez cláusulas: cargo, lugar, duración, período de prueba, jornada, salario, IPS, aguinaldo y
            vacaciones, obligaciones y terminación. Completá lo que está [entre corchetes].
          </p>
          <a
            href="/descargas/modelo-contrato-de-trabajo.docx"
            download
            className="mt-3 inline-flex items-center min-h-11 px-4 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink/90"
          >
            Descargar modelo en Word (.docx)
          </a>
        </div>
      }
      toc={[
        { id: 'que-incluir', label: 'Qué debe incluir un contrato de trabajo' },
        { id: 'tipos', label: 'Tipos de contrato de trabajo' },
        { id: 'prueba', label: 'Período de prueba' },
        { id: 'salario', label: 'Salario, jornada y beneficios de ley' },
        { id: 'registro', label: 'Inscripción en IPS y MTESS' },
        { id: 'modelo', label: 'Texto del modelo de contrato' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['salarioMinimo', 'aguinaldo', 'preaviso', 'entrevista']}
      cta="empresas"
      sources={
        <>
          <p>
            <strong className="text-ink">Fuente:</strong> Código del Trabajo (Ley N.º 213/93); Ley N.º
            6738/2021 de teletrabajo; salario mínimo según {SALARIO_MINIMO.decreto}.
          </p>
          <p className="mt-2">
            Modelo orientativo: adaptalo a cada caso y, ante dudas, consultá a un profesional.
          </p>
        </>
      }
    >
      <h2 id="que-incluir">Qué debe incluir un contrato de trabajo</h2>
      <ul>
        <li><strong>Datos de las partes:</strong> razón social, RUC y domicilio del empleador; nombre, cédula y domicilio del trabajador.</li>
        <li><strong>Cargo y tareas</strong> que va a realizar.</li>
        <li><strong>Lugar de trabajo</strong> (o teletrabajo, si corresponde).</li>
        <li><strong>Duración</strong> y fecha de inicio.</li>
        <li><strong>Período de prueba</strong>, si se pacta.</li>
        <li><strong>Jornada y horario.</strong></li>
        <li><strong>Salario</strong>, forma y fecha de pago.</li>
        <li><strong>Firmas</strong> de ambas partes, en dos ejemplares.</li>
      </ul>

      <h2 id="tipos">Tipos de contrato de trabajo</h2>
      <ul>
        <li><strong>Por tiempo indefinido:</strong> el más común; no tiene fecha de finalización.</li>
        <li><strong>Por plazo determinado:</strong> con fecha de inicio y de fin, para necesidades temporales.</li>
        <li><strong>Por obra o servicio determinado:</strong> termina al concluir la obra o el servicio pactado.</li>
        <li>
          <strong>Teletrabajo:</strong> cualquiera de los anteriores, en modalidad remota, regulado por la
          Ley N.º 6738/2021.
        </li>
      </ul>
      <p>
        La jornada puede ser completa o a tiempo parcial; en ambos casos rigen los mismos derechos, en
        proporción a las horas.
      </p>

      <h2 id="prueba">Período de prueba</h2>
      <p>
        El período de prueba permite a las dos partes evaluar la relación. Según el artículo 58 del
        Código del Trabajo, dura como máximo <strong>30 días</strong> para trabajadores no calificados y
        personal doméstico, y <strong>60 días</strong> para trabajadores calificados o aprendices. Es
        remunerado, y si al terminar ninguna de las partes expresa su voluntad de terminar, el contrato
        sigue vigente.
      </p>

      <h2 id="salario">Salario, jornada y beneficios de ley</h2>
      <p>
        El salario no puede ser inferior al <Link href={GUIDES.salarioMinimo.href}>salario mínimo
        vigente</Link> ({gs(SALARIO_MINIMO.mensual)} desde julio de 2026) para jornada completa. La
        jornada ordinaria diurna es de hasta 8 horas diarias o 48 semanales, y las horas extra se pagan
        con recargo. Además, corresponden el <Link href={GUIDES.aguinaldo.href}>aguinaldo</Link> y las
        vacaciones anuales remuneradas, y al terminar la relación rigen las reglas de{' '}
        <Link href={GUIDES.preaviso.href}>preaviso e indemnización</Link>.
      </p>

      <h2 id="registro">Inscripción en IPS y MTESS</h2>
      <p>
        Desde el primer día, el empleador tiene que inscribir al trabajador en el{' '}
        <strong>Instituto de Previsión Social (IPS)</strong>, retener el 9 % del salario y aportar el
        16,5 % a su cargo, y cumplir con el registro obrero-patronal ante el{' '}
        <strong>Ministerio de Trabajo, Empleo y Seguridad Social (MTESS)</strong>.
      </p>

      <h2 id="modelo">Texto del modelo de contrato de trabajo</h2>
      <p>Este es el contenido del modelo en Word, para que lo revises antes de descargarlo:</p>
      <div className="not-prose rounded-[10px] border border-border bg-white p-5 sm:p-7 text-sm leading-relaxed text-ink space-y-3 shadow-card">
        <p className="text-center font-bold">CONTRATO INDIVIDUAL DE TRABAJO</p>
        <p>
          En la ciudad de [Ciudad], a los [día] días del mes de [mes] de [año], entre [Razón social],
          RUC N.º [ ], con domicilio en [ ], representada por [ ], en adelante EL EMPLEADOR; y [Nombre y
          apellido], C.I. N.º [ ], domiciliado/a en [ ], en adelante EL TRABAJADOR, se celebra el
          presente contrato individual de trabajo, regido por el Código del Trabajo (Ley N.º 213/93) y
          las siguientes cláusulas:
        </p>
        <p><strong>PRIMERA. Cargo y tareas.</strong> EL TRABAJADOR prestará servicios como [cargo], realizando [tareas].</p>
        <p><strong>SEGUNDA. Lugar de trabajo.</strong> [Dirección] [o teletrabajo, Ley N.º 6738/2021].</p>
        <p><strong>TERCERA. Duración.</strong> Por tiempo indefinido [o plazo / obra determinada], desde el [fecha].</p>
        <p><strong>CUARTA. Período de prueba.</strong> [30 / 60] días, conforme al art. 58 del Código del Trabajo.</p>
        <p><strong>QUINTA. Jornada y horario.</strong> [ ] horas diarias, de [día] a [día], de [hora] a [hora].</p>
        <p><strong>SEXTA. Remuneración.</strong> Gs. [monto] mensuales, pagaderos [forma], no inferior al mínimo legal.</p>
        <p><strong>SÉPTIMA. Seguridad social.</strong> Inscripción en el IPS desde el inicio y aportes de ley.</p>
        <p><strong>OCTAVA. Aguinaldo y vacaciones.</strong> Conforme al Código del Trabajo.</p>
        <p><strong>NOVENA. Obligaciones.</strong> Las del Código del Trabajo y el reglamento interno.</p>
        <p><strong>DÉCIMA. Terminación.</strong> Según el Código del Trabajo (preaviso, indemnización y causas justificadas).</p>
        <p>Se firman dos ejemplares de un mismo tenor, en el lugar y la fecha indicados.</p>
      </div>
      <p>
        ¿Ya tenés el contrato y te falta la persona? <Link href="/publicar">Publicá tu oferta de
        empleo gratis</Link> y recibí postulantes en tu WhatsApp.
      </p>
    </GuidePage>
  );
}
