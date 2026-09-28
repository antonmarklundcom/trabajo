// Paraguayan labour-law figures and formulas used by the resource guides
// (salario mínimo, aguinaldo, preaviso, indemnización — PLAN-SEO.md).
//
// ONE place for every amount the site states. When the minimum wage is
// readjusted (every July, by decree), update `SALARIO_MINIMO` here and every
// page — the salary guide, the aguinaldo table, the overtime example — moves
// with it. Each figure names its source so the next person to touch it can
// check it rather than trust it.
//
// Plain data and pure functions: the aguinaldo calculator is a client
// component and imports from here.

/**
 * Salario mínimo legal para actividades diversas no especificadas.
 * Source: Decreto N.º 6225/2026 (Poder Ejecutivo), in force from 1 July 2026;
 * MTESS announcement https://www.mtess.gov.py/?p=36166 (5 % readjustment).
 */
export const SALARIO_MINIMO = {
  mensual: 3_044_000,
  /** Jornal mínimo diario: the monthly minimum ÷ 26 working days, as the decree publishes it. */
  jornal: 117_077,
  anterior: 2_899_048,
  vigenteDesde: '2026-07-01',
  decreto: 'Decreto N.º 6225/2026',
  fuente: 'https://www.mtess.gov.py/?p=36166',
} as const;

/** Night work is paid with a 30 % surcharge over the daytime rate (Código del Trabajo). */
export const RECARGO_NOCTURNO = 0.3;
/** Overtime surcharges, art. 234 Código del Trabajo: 50 % daytime, 100 % night. */
export const RECARGO_HORA_EXTRA_DIURNA = 0.5;
export const RECARGO_HORA_EXTRA_NOCTURNA = 1;

/** IPS contribution rates on salary: 9 % withheld from the worker, 16,5 % paid by the employer. */
export const IPS_APORTE_TRABAJADOR = 0.09;
export const IPS_APORTE_EMPLEADOR = 0.165;

/** Daily jornada: 8 hours daytime (48/week), 7 hours night (42/week) — art. 194. */
export const HORAS_JORNADA_DIURNA = 8;
export const HORAS_JORNADA_NOCTURNA = 7;

export const salarioMinimoDerivado = {
  hora: Math.round(SALARIO_MINIMO.jornal / HORAS_JORNADA_DIURNA),
  nocturnoMensual: Math.round(SALARIO_MINIMO.mensual * (1 + RECARGO_NOCTURNO)),
  horaExtraDiurna: Math.round((SALARIO_MINIMO.jornal / HORAS_JORNADA_DIURNA) * (1 + RECARGO_HORA_EXTRA_DIURNA)),
  ipsTrabajador: Math.round(SALARIO_MINIMO.mensual * IPS_APORTE_TRABAJADOR),
  ipsEmpleador: Math.round(SALARIO_MINIMO.mensual * IPS_APORTE_EMPLEADOR),
  neto: SALARIO_MINIMO.mensual - Math.round(SALARIO_MINIMO.mensual * IPS_APORTE_TRABAJADOR),
};

/** "3.044.000" — Paraguayan thousands separator, no decimals, deterministic on server and client. */
export function formatGuaranies(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "Gs. 3.044.000" */
export function gs(amount: number): string {
  return `Gs. ${formatGuaranies(amount)}`;
}

// ---------------------------------------------------------------------------
// Aguinaldo — art. 243 Código del Trabajo: one twelfth of everything earned in
// the calendar year "en todo concepto" (salary, overtime, commissions, …),
// paid by 31 December or when the employment ends, whichever comes first.
// ---------------------------------------------------------------------------

/** The aguinaldo for a year's total earnings. */
export function aguinaldo(totalCobradoEnElAnio: number): number {
  if (!Number.isFinite(totalCobradoEnElAnio) || totalCobradoEnElAnio <= 0) return 0;
  return Math.round(totalCobradoEnElAnio / 12);
}

/** Fixed monthly salary for `meses` months, plus any variable earnings in the year. */
export function aguinaldoSueldoFijo(sueldoMensual: number, meses: number, extras = 0): number {
  const m = Math.min(12, Math.max(0, meses));
  return aguinaldo(sueldoMensual * m + Math.max(0, extras));
}

// ---------------------------------------------------------------------------
// Preaviso and indemnización — arts. 87 and 91 Código del Trabajo.
// ---------------------------------------------------------------------------

/** Notice days owed for an indefinite contract, by completed seniority (art. 87). */
export function diasDePreaviso(antiguedadMeses: number): number {
  if (antiguedadMeses <= 12) return 30;
  if (antiguedadMeses <= 60) return 45;
  if (antiguedadMeses <= 120) return 60;
  return 90;
}

/**
 * Daily wages owed as indemnización for dismissal without just cause (art. 91):
 * 15 per year of service or fraction of six months.
 */
export function jornalesDeIndemnizacion(antiguedadMeses: number): number {
  const anios = Math.floor(antiguedadMeses / 12);
  const resto = antiguedadMeses % 12;
  return 15 * (anios + (resto >= 6 ? 1 : 0));
}
