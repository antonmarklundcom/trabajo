import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import AguinaldoCalculator from '@/components/guide/AguinaldoCalculator';
import { aguinaldoSueldoFijo, gs, SALARIO_MINIMO } from '@/lib/labor-law';
import { GUIDES } from '@/lib/guides';

// Keyword groups served here (PLAN-SEO.md §1): "como se calcula el aguinaldo",
// "calculo de aguinaldo", "cada cuanto se cobra el aguinaldo", "como sacar
// aguinaldo", "1 año de trabajo aguinaldo", "aguinaldo cuándo se cobra",
// "a los cuantos meses me corresponde aguinaldo", "aguinaldo proporcional",
// "aguinaldo es la mitad del sueldo", "aguinaldo incluye horas extras",
// "aguinaldo comisiones" — ≈26.000 searches/month, one page, one H2 each.

const TITLE = 'Calculadora de aguinaldo 2026: cómo se calcula en Paraguay';
const DESCRIPTION =
  'Calculá tu aguinaldo en segundos, con sueldo fijo o variable, completo o proporcional. Cómo se calcula según el Código del Trabajo, cuándo se cobra y ejemplos.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.aguinaldo.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const FAQ: FaqItem[] = [
  {
    q: '¿Cómo se calcula el aguinaldo en Paraguay?',
    a: 'Se suma todo lo que cobraste en el año calendario (sueldo, horas extra, comisiones y demás pagos salariales) y se divide entre 12. Con un sueldo fijo el año completo, el aguinaldo es igual a un sueldo mensual.',
  },
  {
    q: '¿Hasta cuándo se paga el aguinaldo?',
    a: 'A más tardar el 31 de diciembre de cada año. Si la relación laboral termina antes, el aguinaldo proporcional se paga junto con la liquidación final.',
  },
  {
    q: '¿Cuántos meses tengo que trabajar para cobrar aguinaldo?',
    a: 'La ley no pide una antigüedad mínima: corresponde de forma proporcional a lo que cobraste en el año, aunque hayas trabajado un solo mes.',
  },
  {
    q: '¿El aguinaldo es medio sueldo?',
    a: 'No. Es la doceava parte de todo lo cobrado en el año, así que para quien trabajó los doce meses con el mismo sueldo equivale a un sueldo completo. Es menor si trabajaste menos meses.',
  },
  {
    q: '¿Al aguinaldo se le descuenta el IPS?',
    a: 'No. El aguinaldo no está sujeto al aporte del IPS: el monto calculado es el que tenés que cobrar.',
  },
  {
    q: '¿Las horas extra y las comisiones entran en el aguinaldo?',
    a: 'Sí. La ley habla de las remuneraciones devengadas en todo concepto, así que las horas extra, las comisiones y otros pagos salariales del año se suman antes de dividir entre 12.',
  },
];

export default function AguinaldoPage() {
  const sm = SALARIO_MINIMO.mensual;
  const proporcional = [1, 2, 3, 4, 5, 6, 9, 12];

  return (
    <GuidePage
      guideKey="aguinaldo"
      title="Calculadora de aguinaldo 2026 en Paraguay"
      description={DESCRIPTION}
      crumbLabel="Calculadora de aguinaldo"
      lede={
        <p>
          El aguinaldo es la doceava parte de todo lo que cobraste en el año. Cargá tu sueldo en la
          calculadora y sabé cuánto te corresponde, sea el año completo o un aguinaldo proporcional.
          Abajo te explicamos cómo se calcula, cuándo se cobra y qué entra en la cuenta.
        </p>
      }
      hero={<AguinaldoCalculator />}
      toc={[
        { id: 'como-se-calcula', label: 'Cómo se calcula el aguinaldo' },
        { id: 'ejemplos', label: 'Ejemplos de cálculo' },
        { id: 'proporcional', label: 'Aguinaldo proporcional: cuánto te toca según los meses' },
        { id: 'cuando-se-cobra', label: 'Cuándo se cobra el aguinaldo' },
        { id: 'que-incluye', label: 'Qué entra en la cuenta' },
        { id: 'medio-sueldo', label: '¿Es medio sueldo? ¿Bruto o neto?' },
        { id: 'si-no-pagan', label: 'Qué hacer si no te pagan' },
        { id: 'empleadores', label: 'Para empleadores' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['salarioMinimo', 'preaviso', 'contrato', 'curriculum']}
      cta="ambos"
      sources={
        <>
          <p>
            <strong className="text-ink">Fuente:</strong> Código del Trabajo (Ley N.º 213/93), art. 243 y
            siguientes; Ministerio de Trabajo, Empleo y Seguridad Social (MTESS). Salario mínimo:{' '}
            {SALARIO_MINIMO.decreto}.
          </p>
          <p className="mt-2">
            Esta página es informativa y no reemplaza el asesoramiento de un profesional. Para tu caso
            puntual, consultá al MTESS o a un abogado laboralista.
          </p>
        </>
      }
    >
      <h2 id="como-se-calcula">Cómo se calcula el aguinaldo</h2>
      <p>
        Según el artículo 243 del Código del Trabajo, el aguinaldo es una remuneración anual
        complementaria equivalente a <strong>la doceava parte de las remuneraciones devengadas durante
        el año calendario</strong>, en todo concepto. La fórmula es una sola:
      </p>
      <blockquote>
        <p>
          <strong>Aguinaldo = total cobrado de enero a diciembre ÷ 12</strong>
        </p>
      </blockquote>
      <p>
        Para “sacar” el aguinaldo, entonces, necesitás tus recibos de sueldo del año: sumás el salario
        de cada mes más las horas extra, comisiones y otros pagos salariales, y dividís ese total entre
        doce. No importa si cobrás por mes, por quincena o por jornal: la cuenta es siempre sobre lo que
        efectivamente cobraste en el año.
      </p>

      <h2 id="ejemplos">Ejemplos de cálculo</h2>
      <h3>Sueldo fijo, año completo</h3>
      <p>
        Si cobraste el salario mínimo ({gs(sm)}) los doce meses del año: {gs(sm)} × 12 = {gs(sm * 12)}.
        Dividido entre 12, tu aguinaldo es <strong>{gs(aguinaldoSueldoFijo(sm, 12))}</strong>: un sueldo
        completo.
      </p>
      <h3>Sueldo que cambió durante el año, con horas extra</h3>
      <p>
        Cobraste Gs. 3.000.000 de enero a junio, Gs. 3.300.000 de julio a diciembre y además Gs. 600.000
        de horas extra en noviembre:
      </p>
      <ul>
        <li>Total del año: (3.000.000 × 6) + (3.300.000 × 6) + 600.000 = Gs. 38.400.000</li>
        <li>
          Aguinaldo: 38.400.000 ÷ 12 = <strong>Gs. 3.200.000</strong>
        </li>
      </ul>
      <p>
        Si tu sueldo varía todos los meses (por comisiones, por ejemplo), usá la opción “Mes por mes”
        de la calculadora y cargá lo que cobraste en cada uno.
      </p>

      <h2 id="proporcional">Aguinaldo proporcional: cuánto te toca según los meses trabajados</h2>
      <p>
        Si empezaste a trabajar durante el año, o si renunciaste o te despidieron antes de diciembre,
        te corresponde el <strong>aguinaldo proporcional</strong>: la misma cuenta, pero sumando solo
        lo que cobraste en los meses trabajados. No hay un mínimo de meses para tener derecho.
      </p>
      <p>Con el salario mínimo vigente ({gs(sm)} por mes), el aguinaldo proporcional queda así:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Meses trabajados</th>
              <th scope="col">Total cobrado</th>
              <th scope="col">Aguinaldo</th>
            </tr>
          </thead>
          <tbody>
            {proporcional.map((m) => (
              <tr key={m}>
                <td>{m === 12 ? '12 (1 año de trabajo)' : `${m} ${m === 1 ? 'mes' : 'meses'}`}</td>
                <td>{gs(sm * m)}</td>
                <td>{gs(aguinaldoSueldoFijo(sm, m))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Si entraste a mitad de mes, sumá solo lo que cobraste ese mes: el aguinaldo sigue a lo cobrado,
        no a los meses del calendario.
      </p>

      <h2 id="cuando-se-cobra">Cuándo se cobra el aguinaldo</h2>
      <p>
        El aguinaldo se cobra <strong>una vez por año</strong> y el empleador tiene que pagarlo{' '}
        <strong>a más tardar el 31 de diciembre</strong>. Si la relación laboral termina antes de esa
        fecha, el aguinaldo proporcional se paga con la liquidación final, junto con lo demás que
        corresponda (por ejemplo, el{' '}
        <Link href={GUIDES.preaviso.href}>preaviso y la indemnización</Link> en caso de despido).
      </p>
      <p>
        Muchas empresas lo pagan antes, en la primera o segunda quincena de diciembre, pero la fecha
        límite legal es el último día del año.
      </p>

      <h2 id="que-incluye">Qué entra en la cuenta del aguinaldo</h2>
      <p>Se suman todas las remuneraciones del año, en todo concepto:</p>
      <ul>
        <li>El sueldo o salario de cada mes (o los jornales cobrados).</li>
        <li>
          Las <strong>horas extra</strong> pagadas (ver{' '}
          <Link href={`${GUIDES.salarioMinimo.href}#horas-extras`}>cómo se pagan las horas extra</Link>).
        </li>
        <li>Las <strong>comisiones</strong> por ventas.</li>
        <li>Otros pagos con carácter salarial, como bonificaciones por producción.</li>
      </ul>
      <p>
        Por eso, si tu sueldo tiene una parte variable, tu aguinaldo va a ser distinto de tu sueldo
        base. Guardá tus recibos de todo el año para poder controlar la cuenta.
      </p>

      <h2 id="medio-sueldo">¿El aguinaldo es medio sueldo? ¿Se calcula sobre el bruto o el neto?</h2>
      <p>
        No es medio sueldo. Para quien trabajó los doce meses con el mismo salario, el aguinaldo es{' '}
        <strong>un sueldo completo</strong>; solo es menor si trabajaste parte del año. Se calcula sobre
        lo que ganaste (el bruto, antes del descuento del IPS), y{' '}
        <strong>al aguinaldo no se le descuenta el aporte al IPS</strong>: el monto que te da la cuenta
        es el que tenés que cobrar.
      </p>

      <h2 id="si-no-pagan">Qué hacer si no te pagan el aguinaldo</h2>
      <ol>
        <li>Revisá la cuenta con tus recibos de sueldo y esta calculadora.</li>
        <li>Planteale el tema a tu empleador por escrito: un correo o un mensaje sirven como respaldo.</li>
        <li>
          Si no hay respuesta, podés hacer una consulta o denuncia ante el Ministerio de Trabajo,
          Empleo y Seguridad Social (MTESS), que cada fin de año recuerda la obligación de pagarlo.
        </li>
      </ol>

      <h2 id="empleadores">Para empleadores</h2>
      <p>
        El cálculo en planilla es el mismo: la suma de las remuneraciones pagadas a cada trabajador en
        el año, dividida entre 12, con pago hasta el 31 de diciembre o al terminar la relación laboral.
        Si estás por sumar personal, podés{' '}
        <Link href="/publicar">publicar tu oferta de empleo gratis</Link> y revisar el{' '}
        <Link href={GUIDES.contrato.href}>modelo de contrato de trabajo</Link>.
      </p>
    </GuidePage>
  );
}
