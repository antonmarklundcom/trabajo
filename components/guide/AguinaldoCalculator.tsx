'use client';

// The aguinaldo calculator on /calculadora-de-aguinaldo. All arithmetic is the
// pure functions in lib/labor-law.ts; this file is only inputs and display.
// Nothing typed here leaves the browser.
import { useId, useState } from 'react';
import { aguinaldo, formatGuaranies, gs, SALARIO_MINIMO } from '@/lib/labor-law';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "3.044.000" or "3044000" or "Gs 3.044.000" → 3044000. */
function parseAmount(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function display(raw: string): string {
  const n = parseAmount(raw);
  return n > 0 ? formatGuaranies(n) : '';
}

const inputCls =
  'w-full min-h-11 rounded-[10px] border border-border-strong bg-white px-3 text-base text-ink tabular-nums focus:border-brand';

export default function AguinaldoCalculator() {
  const id = useId();
  const [mode, setMode] = useState<'fijo' | 'variable'>('fijo');
  const [sueldo, setSueldo] = useState('');
  const [meses, setMeses] = useState(12);
  const [extras, setExtras] = useState('');
  const [porMes, setPorMes] = useState<string[]>(() => Array(12).fill(''));

  const totalFijo = parseAmount(sueldo) * meses + parseAmount(extras);
  const totalVariable = porMes.reduce((sum, v) => sum + parseAmount(v), 0);
  const total = mode === 'fijo' ? totalFijo : totalVariable;
  const resultado = aguinaldo(total);

  const tabCls = (active: boolean) =>
    `flex-1 min-h-11 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
      active ? 'bg-ink text-white' : 'text-ink-secondary hover:text-ink'
    }`;

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-card border border-border bg-surface shadow-card p-5 sm:p-6"
    >
      <h2 id={`${id}-titulo`} className="text-lg font-bold text-ink">
        Calculá tu aguinaldo
      </h2>

      <div className="mt-4 flex gap-1 rounded-[12px] bg-surface-2 p-1" role="tablist" aria-label="Tipo de sueldo">
        <button type="button" role="tab" aria-selected={mode === 'fijo'} className={tabCls(mode === 'fijo')} onClick={() => setMode('fijo')}>
          Sueldo fijo
        </button>
        <button type="button" role="tab" aria-selected={mode === 'variable'} className={tabCls(mode === 'variable')} onClick={() => setMode('variable')}>
          Mes por mes
        </button>
      </div>

      {mode === 'fijo' ? (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-sueldo`} className="block text-sm font-medium text-ink mb-1.5">
              Sueldo mensual (bruto, en guaraníes)
            </label>
            <input
              id={`${id}-sueldo`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej.: 3.044.000"
              className={inputCls}
              value={display(sueldo)}
              onChange={(e) => setSueldo(e.target.value)}
            />
            <button
              type="button"
              className="mt-1.5 text-sm text-brand hover:underline"
              onClick={() => setSueldo(String(SALARIO_MINIMO.mensual))}
            >
              Usar el salario mínimo ({gs(SALARIO_MINIMO.mensual)})
            </button>
          </div>
          <div>
            <label htmlFor={`${id}-meses`} className="block text-sm font-medium text-ink mb-1.5">
              Meses trabajados este año
            </label>
            <select
              id={`${id}-meses`}
              className={inputCls}
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 12 ? '12 (el año completo)' : `${n} ${n === 1 ? 'mes' : 'meses'}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-extras`} className="block text-sm font-medium text-ink mb-1.5">
              Horas extra y comisiones del año
            </label>
            <input
              id={`${id}-extras`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className={inputCls}
              value={display(extras)}
              onChange={(e) => setExtras(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-sm text-ink-secondary mb-3">
            Cargá lo que cobraste cada mes (sueldo + horas extra + comisiones). Dejá en blanco los meses que no trabajaste.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MESES.map((mes, i) => (
              <div key={mes}>
                <label htmlFor={`${id}-mes-${i}`} className="block text-xs font-medium text-ink-secondary mb-1">
                  {mes}
                </label>
                <input
                  id={`${id}-mes-${i}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className={inputCls}
                  value={display(porMes[i])}
                  onChange={(e) => {
                    const next = [...porMes];
                    next[i] = e.target.value;
                    setPorMes(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-[12px] bg-gold-tint border border-border p-4" aria-live="polite">
        <p className="text-sm text-ink-secondary">Tu aguinaldo estimado</p>
        <p className="mt-1 text-3xl font-extrabold text-ink tabular-nums">{gs(resultado)}</p>
        <p className="mt-2 text-sm text-ink-secondary tabular-nums">
          {total > 0
            ? `Total cobrado en el año: ${gs(total)} ÷ 12 = ${gs(resultado)}`
            : 'Completá los datos para ver el cálculo.'}
        </p>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Estimación informativa según el art. 243 del Código del Trabajo. El aguinaldo no lleva descuento de IPS.
      </p>
    </section>
  );
}
