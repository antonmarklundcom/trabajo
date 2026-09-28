import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalFor } from '@/lib/seo';
import GuidePage, { type FaqItem } from '@/components/guide/GuidePage';
import { GUIDES } from '@/lib/guides';
import {
  gs,
  HORAS_JORNADA_DIURNA,
  HORAS_JORNADA_NOCTURNA,
  IPS_APORTE_EMPLEADOR,
  IPS_APORTE_TRABAJADOR,
  SALARIO_MINIMO,
  salarioMinimoDerivado,
} from '@/lib/labor-law';

// Keyword groups (PLAN-SEO.md §0): "salario minimo paraguay 2026", "jornal
// minimo paraguay", "sueldo promedio paraguay", "horas extras paraguay".
// Every amount on this page comes from lib/labor-law.ts — update the decree
// figures there, never here.

const TITLE = 'Salario mínimo Paraguay 2026: Gs. 3.044.000, jornal y hora';
const DESCRIPTION =
  'Salario mínimo en Paraguay 2026: Gs. 3.044.000 desde el 1 de julio (Decreto 6225/2026). Jornal mínimo, valor de la hora, trabajo nocturno, descuento de IPS y horas extras.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalFor(GUIDES.salarioMinimo.href) },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'article' },
};

const pct = (n: number) => `${String(Math.round(n * 1000) / 10).replace('.', ',')} %`;

export default function SalarioMinimoPage() {
  const sm = SALARIO_MINIMO;
  const d = salarioMinimoDerivado;

  const FAQ: FaqItem[] = [
    {
      q: '¿Cuánto es el salario mínimo en Paraguay en 2026?',
      a: `${gs(sm.mensual)} por mes para actividades diversas no especificadas, vigente desde el 1 de julio de 2026 (${sm.decreto}).`,
    },
    {
      q: '¿Cuánto es el jornal mínimo?',
      a: `${gs(sm.jornal)} por día, que surge de dividir el salario mínimo mensual entre 26 días laborales.`,
    },
    {
      q: '¿Cuánto cobro en mano con el salario mínimo?',
      a: `Con el descuento del 9 % de IPS (${gs(d.ipsTrabajador)}), el neto es de ${gs(d.neto)}.`,
    },
    {
      q: '¿Cada cuánto se reajusta el salario mínimo?',
      a: 'Se revisa una vez al año, a mitad de año, y el reajuste se fija por decreto del Poder Ejecutivo. El próximo se espera para julio de 2027.',
    },
  ];

  return (
    <GuidePage
      guideKey="salarioMinimo"
      title="Salario mínimo en Paraguay 2026"
      description={DESCRIPTION}
      crumbLabel="Salario mínimo"
      lede={
        <p>
          Desde el 1 de julio de 2026, el salario mínimo legal en Paraguay es de{' '}
          <strong className="text-ink">{gs(sm.mensual)} por mes</strong> ({sm.decreto}), un 5 % más que
          los {gs(sm.anterior)} anteriores. Acá tenés el jornal, el valor de la hora, el mínimo para
          trabajo nocturno, cuánto queda después del IPS y cómo se pagan las horas extra.
        </p>
      }
      hero={
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Mensual', gs(sm.mensual)],
            ['Jornal diario', gs(sm.jornal)],
            ['Hora diurna', gs(d.hora)],
            ['Nocturno mensual', gs(d.nocturnoMensual)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-border bg-surface p-4 shadow-card">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{label}</dt>
              <dd className="mt-1 text-lg font-extrabold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      }
      toc={[
        { id: 'montos', label: 'Salario mínimo 2026: todos los montos' },
        { id: 'jornal', label: 'Jornal mínimo y valor de la hora' },
        { id: 'ips', label: 'Cuánto queda después del IPS' },
        { id: 'nocturno', label: 'Salario mínimo nocturno' },
        { id: 'horas-extras', label: 'Horas extras en Paraguay' },
        { id: 'a-quien', label: 'A quién alcanza y cuándo se reajusta' },
        { id: 'empleadores', label: 'Para empleadores' },
        { id: 'preguntas-frecuentes', label: 'Preguntas frecuentes' },
      ]}
      faq={FAQ}
      related={['aguinaldo', 'preaviso', 'contrato', 'entrevista']}
      cta="ambos"
      sources={
        <>
          <p>
            <strong className="text-ink">Fuentes:</strong> {sm.decreto} del Poder Ejecutivo, vigente
            desde el 1 de julio de 2026; comunicado del Ministerio de Trabajo, Empleo y Seguridad Social
            (<a href={sm.fuente} className="text-brand underline" rel="noopener noreferrer" target="_blank">MTESS</a>);
            Código del Trabajo (Ley N.º 213/93), arts. 194 y 234.
          </p>
          <p className="mt-2">
            Esta página es informativa y no reemplaza el asesoramiento de un profesional.
          </p>
        </>
      }
    >
      <h2 id="montos">Salario mínimo 2026: todos los montos</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Monto</th>
              <th scope="col">Cómo se obtiene</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Salario mínimo mensual</td><td>{gs(sm.mensual)}</td><td>Actividades diversas no especificadas</td></tr>
            <tr><td>Jornal mínimo diario</td><td>{gs(sm.jornal)}</td><td>Mensual ÷ 26 días laborales</td></tr>
            <tr><td>Hora diurna</td><td>{gs(d.hora)}</td><td>Jornal ÷ {HORAS_JORNADA_DIURNA} horas</td></tr>
            <tr><td>Mínimo mensual nocturno</td><td>{gs(d.nocturnoMensual)}</td><td>Mensual + 30 %</td></tr>
            <tr><td>Aporte IPS del trabajador ({pct(IPS_APORTE_TRABAJADOR)})</td><td>{gs(d.ipsTrabajador)}</td><td>Se descuenta del sueldo</td></tr>
            <tr><td>Neto a cobrar</td><td>{gs(d.neto)}</td><td>Mensual − IPS</td></tr>
            <tr><td>Aporte IPS del empleador ({pct(IPS_APORTE_EMPLEADOR)})</td><td>{gs(d.ipsEmpleador)}</td><td>Lo paga la empresa, no se descuenta</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        El monto anterior, vigente hasta el 30 de junio de 2026, era de {gs(sm.anterior)}: el reajuste
        fue de {gs(sm.mensual - sm.anterior)} por mes.
      </p>

      <h2 id="jornal">Jornal mínimo y valor de la hora</h2>
      <p>
        El <strong>jornal mínimo</strong> es lo mínimo que se puede pagar por un día de trabajo:{' '}
        {gs(sm.jornal)}, que resulta de dividir el salario mensual entre 26 días laborales. Aplica a
        quienes cobran por día (jornaleros). Dividido entre las {HORAS_JORNADA_DIURNA} horas de la
        jornada diurna, <strong>la hora de salario mínimo vale {gs(d.hora)}</strong>.
      </p>

      <h2 id="ips">Cuánto queda después del IPS</h2>
      <p>
        Del salario se descuenta el <strong>9 % de aporte obrero al IPS</strong>, que te da cobertura
        de salud y jubilación. Con el mínimo, son {gs(d.ipsTrabajador)} por mes y cobrás en mano{' '}
        <strong>{gs(d.neto)}</strong>. El empleador paga además un 16,5 % por su cuenta (
        {gs(d.ipsEmpleador)}), que no sale de tu sueldo. El{' '}
        <Link href={GUIDES.aguinaldo.href}>aguinaldo</Link>, en cambio, no lleva descuento de IPS.
      </p>

      <h2 id="nocturno">Salario mínimo nocturno</h2>
      <p>
        El trabajo nocturno —entre las 20:00 y las 06:00— se paga con un recargo del 30 % y tiene una
        jornada más corta: {HORAS_JORNADA_NOCTURNA} horas por día o 42 por semana, frente a las{' '}
        {HORAS_JORNADA_DIURNA} horas y 48 semanales del turno diurno. Por eso el mínimo mensual para un
        puesto nocturno es de <strong>{gs(d.nocturnoMensual)}</strong>.
      </p>

      <h2 id="horas-extras">Horas extras en Paraguay: cómo se pagan</h2>
      <p>
        Las horas que superan la jornada ordinaria se pagan con recargo, según el artículo 234 del
        Código del Trabajo:
      </p>
      <ul>
        <li><strong>Hora extra diurna:</strong> 50 % más que la hora normal.</li>
        <li><strong>Hora extra nocturna:</strong> 100 % más que la hora nocturna normal.</li>
      </ul>
      <p>
        Con el salario mínimo, una hora extra diurna vale {gs(d.hora)} × 1,5 ={' '}
        <strong>{gs(d.horaExtraDiurna)}</strong>. Si hacés horas extra seguido, guardá el registro:
        también suman para el <Link href={GUIDES.aguinaldo.href}>cálculo del aguinaldo</Link>.
      </p>

      <h2 id="a-quien">A quién alcanza y cuándo se reajusta</h2>
      <p>
        El salario mínimo es el piso para todo trabajador en relación de dependencia del sector privado
        con jornada completa: ningún contrato puede pagar menos. Existen escalas específicas para
        algunas actividades, que se publican junto con el decreto; si tu rubro tiene una, esa es la
        referencia. Quien trabaja a tiempo parcial cobra, como mínimo, la proporción de las horas
        trabajadas.
      </p>
      <p>
        El monto se revisa <strong>una vez al año</strong>, a mitad de año, y lo fija el Poder
        Ejecutivo por decreto. Esta página se actualiza con cada reajuste.
      </p>

      <h2 id="empleadores">Para empleadores</h2>
      <p>
        Al contratar a una persona con el salario mínimo, el costo mensual para la empresa es el sueldo
        más el 16,5 % de aporte patronal al IPS: {gs(sm.mensual + d.ipsEmpleador)}, sin contar el
        aguinaldo ni las vacaciones. Si estás por sumar personal, revisá el{' '}
        <Link href={GUIDES.contrato.href}>modelo de contrato de trabajo</Link> y{' '}
        <Link href="/publicar">publicá tu oferta de empleo</Link>.
      </p>
    </GuidePage>
  );
}
