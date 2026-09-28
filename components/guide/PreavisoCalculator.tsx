'use client';

// Preaviso and indemnización estimate on /preaviso-e-indemnizacion. The rules
// are the pure functions in lib/labor-law.ts (arts. 87 and 91); this file is
// inputs and display only. Nothing typed here leaves the browser.
import { useId, useState } from 'react';
import { diasDePreaviso, formatGuaranies, gs, jornalesDeIndemnizacion } from '@/lib/labor-law';

function parseAmount(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const inputCls =
  'w-full min-h-11 rounded-[10px] border border-border-strong bg-white px-3 text-base text-ink tabular-nums focus:border-brand';

export default function PreavisoCalculator() {
  const id = useId();
  const [sueldo, setSueldo] = useState('');
  const [anios, setAnios] = useState(1);
  const [meses, setMeses] = useState(0);

  const promedio = parseAmount(sueldo);
  const antiguedad = anios * 12 + meses;
  const diario = promedio / 30;
  const diasPreaviso = diasDePreaviso(antiguedad);
  const jornales = jornalesDeIndemnizacion(antiguedad);
  const montoPreaviso = Math.round(diario * diasPreaviso);
  const montoIndemnizacion = Math.round(diario * jornales);
  const estabilidad = antiguedad >= 120;

  return (
    <section aria-labelledby={`${id}-titulo`} className="rounded-card border border-border bg-surface shadow-card p-5 sm:p-6">
      <h2 id={`${id}-titulo`} className="text-lg font-bold text-ink">
        Calculá tu preaviso e indemnización
      </h2>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-3">
          <label htmlFor={`${id}-sueldo`} className="block text-sm font-medium text-ink mb-1.5">
            Sueldo promedio de los últimos 6 meses (guaraníes)
          </label>
          <input
            id={`${id}-sueldo`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej.: 3.500.000"
            className={inputCls}
            value={promedio > 0 ? formatGuaranies(promedio) : ''}
            onChange={(e) => setSueldo(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-anios`} className="block text-sm font-medium text-ink mb-1.5">
            Años de antigüedad
          </label>
          <select id={`${id}-anios`} className={inputCls} value={anios} onChange={(e) => setAnios(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-meses`} className="block text-sm font-medium text-ink mb-1.5">
            y meses
          </label>
          <select id={`${id}-meses`} className={inputCls} value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-live="polite">
        <div className="rounded-[12px] bg-surface-2 border border-border p-4">
          <dt className="text-sm text-ink-secondary">Preaviso</dt>
          <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{diasPreaviso} días</dd>
          <dd className="text-sm text-ink-secondary tabular-nums">
            {promedio > 0 ? `Si no se otorga: ${gs(montoPreaviso)}` : 'Cargá tu sueldo para ver el monto.'}
          </dd>
        </div>
        <div className="rounded-[12px] bg-gold-tint border border-border p-4">
          <dt className="text-sm text-ink-secondary">Indemnización por despido injustificado</dt>
          <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{promedio > 0 ? gs(montoIndemnizacion) : '—'}</dd>
          <dd className="text-sm text-ink-secondary">{jornales} salarios diarios</dd>
        </div>
      </dl>
      {estabilidad && (
        <p className="mt-3 text-sm text-ink">
          Con 10 años o más de antigüedad rige la estabilidad laboral y la indemnización puede ser el
          doble: consultá tu caso con un abogado laboralista.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Estimación informativa según los arts. 87 y 91 del Código del Trabajo, con salario diario =
        promedio mensual ÷ 30. No incluye aguinaldo proporcional, vacaciones ni días trabajados pendientes.
      </p>
    </section>
  );
}
