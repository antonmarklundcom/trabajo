import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import PreavisoCalculator from '@/components/guide/PreavisoCalculator';
import { GUIDES } from '@/lib/guides';
import { diasDePreaviso, gs, jornalesDeIndemnizacion } from '@/lib/labor-law';

// Keyword groups (PLAN-SEO.md §1): "preaviso paraguay", "despido
// injustificado paraguay", "despido justificado paraguay", "indemnización por
// despido injustificado paraguay", "calculo de liquidacion por despido
// injustificado paraguay", "indemnizacion paraguay". Copy adapted from
// content/blog-drafts/despido-preaviso-e-indemnizacion-en-paraguay.md.

const TITLE = 'Preaviso e indemnización por despido en Paraguay: cálculo 2026';
const DESCRIPTION =
  'Cuántos días de preaviso corresponden según tu antigüedad, cómo se calcula la indemnización por despido injustificado en Paraguay y qué incluye la liquidación final. Con calculadora.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.preaviso.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Cuántos días de preaviso corresponden en Paraguay?',
    a: '30 días hasta un año de antigüedad, 45 días de uno a cinco años, 60 días de cinco a diez años y 90 días con más de diez años (art. 87 del Código del Trabajo).',
  },
  {
    q: '¿Cuánto es la indemnización por despido injustificado?',
    a: 'Quince salarios diarios por cada año de servicio o fracción de seis meses (art. 91), calculados sobre el promedio de lo cobrado en los últimos seis meses.',
  },
  {
    q: '¿Si renuncio me corresponde indemnización?',
    a: 'No. La indemnización corresponde al despido sin causa justificada. Si renunciás, cobrás la liquidación (días trabajados, aguinaldo proporcional, vacaciones pendientes) y tenés que dar el preaviso a tu empleador.',
  },
  {
    q: '¿Qué pasa si el empleador no da el preaviso?',
    a: 'Tiene que pagar el salario correspondiente a los días de preaviso que no otorgó, además de la indemnización si el despido es sin causa justificada.',
  },
];

export default function PreavisoPage() {
  const tramos = [
    { label: 'Hasta 1 año (cumplido el período de prueba)', meses: 12 },
    { label: 'Más de 1 y hasta 5 años', meses: 60 },
    { label: 'Más de 5 y hasta 10 años', meses: 120 },
    { label: 'Más de 10 años', meses: 121 },
  ];
  const ejemploSueldo = 3_600_000;
  const ejemploDiario = ejemploSueldo / 30;
  const ejemploMeses = 3 * 12 + 7;

  return (
    <GuidePage
      guideKey="preaviso"
      title="Preaviso e indemnización por despido en Paraguay"
      description={DESCRIPTION}
      lede={
        <p>
          Si te despiden —o decidís irte— aparecen tres preguntas: ¿me tienen que avisar con tiempo?,
          ¿me corresponde indemnización? y ¿qué tiene que incluir la liquidación? Esta guía resume lo que
          dice el Código del Trabajo (Ley N.º 213/93) para contratos por tiempo indefinido, con una
          calculadora para estimar tu caso.
        </p>
      }
      hero={<PreavisoCalculator />}
      toc={[
        { id: 'conceptos', label: 'Preaviso, indemnización y liquidación' },
        { id: 'preaviso', label: 'Días de preaviso según la antigüedad' },
        { id: 'indemnizacion', label: 'Indemnización por despido injustificado' },
        { id: 'justificado', label: 'Despido justificado' },
        { id: 'estabilidad', label: 'Más de 10 años: estabilidad' },
        { id: 'liquidacion', label: 'Qué incluye la liquidación final' },
        { id: 'checklist', label: 'Qué hacer si te despiden' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['aguinaldo', 'salarioMinimo', 'contrato', 'curriculum']}
      cta="ambos"
      sources={
        <>
          <p>
            <strong className="text-ink">Fuente:</strong> Código del Trabajo (Ley N.º 213/93), arts. 87
            (preaviso), 91 (indemnización) y 94 (estabilidad).
          </p>
          <p className="mt-2">
            Esta página es informativa y no reemplaza el asesoramiento de un profesional. Para tu caso,
            consultá al MTESS o a un abogado laboralista.
          </p>
        </>
      }
    >
      <h2 id="conceptos">Tres conceptos que conviene separar</h2>
      <ul>
        <li><strong>Preaviso:</strong> el aviso anticipado que una parte le da a la otra antes de terminar la relación laboral.</li>
        <li><strong>Indemnización:</strong> el pago que corresponde cuando el empleador despide sin causa justificada.</li>
        <li><strong>Liquidación final:</strong> todo lo que se paga al terminar, haya o no indemnización.</li>
      </ul>

      <h2 id="preaviso">Días de preaviso según la antigüedad</h2>
      <p>
        En los contratos por tiempo indefinido, quien quiere terminar la relación tiene que avisar con
        anticipación. El plazo depende de la antigüedad (art. 87):
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Antigüedad</th>
              <th scope="col">Preaviso</th>
            </tr>
          </thead>
          <tbody>
            {tramos.map((t) => (
              <tr key={t.label}>
                <td>{t.label}</td>
                <td>{diasDePreaviso(t.meses)} días</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Si el empleador no da el preaviso, tiene que pagar el salario de esos días. El preaviso también
        rige para el trabajador que renuncia: si no lo da, puede tener que compensar al empleador con la
        mitad del salario correspondiente a ese plazo. Lo más seguro es darlo y recibirlo por escrito,
        con fecha.
      </p>

      <h2 id="indemnizacion">Indemnización por despido injustificado</h2>
      <p>
        Cuando el empleador despide sin causa justificada, además del preaviso corresponde una
        indemnización de <strong>quince salarios diarios por cada año de servicio o fracción de seis
        meses</strong> (art. 91). El salario diario se calcula sobre el promedio de lo cobrado en los
        últimos seis meses, dividido entre 30.
      </p>
      <p>
        <strong>Ejemplo:</strong> 3 años y 7 meses de antigüedad, con un promedio de {gs(ejemploSueldo)}.
        Salario diario: {gs(ejemploDiario)}. Los 7 meses superan la fracción de seis, así que cuentan como
        un año más: {jornalesDeIndemnizacion(ejemploMeses)} salarios diarios × {gs(ejemploDiario)} ={' '}
        <strong>{gs(ejemploDiario * jornalesDeIndemnizacion(ejemploMeses))}</strong> de indemnización, más{' '}
        {diasDePreaviso(ejemploMeses)} días de preaviso ({gs(ejemploDiario * diasDePreaviso(ejemploMeses))})
        si no se otorgó.
      </p>

      <h2 id="justificado">Despido justificado</h2>
      <p>
        No corresponde indemnización cuando el despido es por una de las causas justificadas que enumera
        el Código del Trabajo (por ejemplo, faltas graves, abandono del trabajo o incumplimientos
        reiterados), ni cuando el trabajador renuncia por voluntad propia. El empleador tiene que
        comunicar la causa por escrito. Durante el período de prueba, cualquiera de las partes puede
        terminar el contrato sin indemnización.
      </p>

      <h2 id="estabilidad">Más de 10 años: la estabilidad laboral</h2>
      <p>
        Quien cumple diez años de trabajo ininterrumpido con el mismo empleador adquiere{' '}
        <strong>estabilidad laboral</strong> (art. 94): solo puede ser despedido por causa justificada
        probada, y si el despido es injustificado la indemnización puede ser doble. Si estás en esa
        situación, la consulta con un abogado laboralista es especialmente importante.
      </p>

      <h2 id="liquidacion">Qué incluye la liquidación final</h2>
      <p>Haya o no indemnización, al terminar la relación laboral se liquidan:</p>
      <ul>
        <li>Los días trabajados del último mes que todavía no cobraste.</li>
        <li>El <Link href={GUIDES.aguinaldo.href}>aguinaldo proporcional</Link> del año en curso.</li>
        <li>Las vacaciones ganadas y no tomadas.</li>
        <li>Horas extra o comisiones pendientes.</li>
        <li>Si corresponde, el preaviso no otorgado y la indemnización.</li>
      </ul>

      <h2 id="checklist">Qué hacer si te despiden</h2>
      <ul>
        <li>Pedí la comunicación por escrito, con fecha y motivo.</li>
        <li>Anotá tu fecha de ingreso para calcular la antigüedad.</li>
        <li>Juntá tus recibos de sueldo, sobre todo los de los últimos seis meses.</li>
        <li>Revisá que la liquidación detalle cada concepto por separado.</li>
        <li>No firmes nada que no entiendas: pedí una copia y leela con calma.</li>
        <li>Verificá en el IPS que tus aportes estén al día.</li>
      </ul>
      <p>
        Y cuando estés listo/a para lo que sigue, actualizá tu{' '}
        <Link href={GUIDES.curriculum.href}>curriculum</Link> y mirá las{' '}
        <Link href="/empleos">ofertas de trabajo publicadas hoy</Link>.
      </p>
    </GuidePage>
  );
}
