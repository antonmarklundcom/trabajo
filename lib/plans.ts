// The three employer packages and their prices: what may be sold, what it
// costs today, and whether a time-limited promotion changes that.
//
// NOT `server-only`, for the same reason lib/featured.ts is not: the admin
// pricing form (a client component) renders and validates against these
// shapes, and the route handler that saves them accepts the same ones. The
// values the PUBLIC site shows are read through lib/pricing.ts (server-only,
// cached), which starts from DEFAULT_PLAN_PRICING below and overlays whatever
// /admin/precios saved in `plan_prices`.
//
// Two rules this module encodes, both about honesty rather than code taste:
//
//   - A promotion always has an end date, and it really ends. activePromo()
//     returns null the moment `promoEndsAt` passes — no cron, no deploy — so
//     "Gratis hasta el 31 de octubre" on the site is a promise the code keeps.
//     A countdown that silently resets is misleading advertising (Ley
//     1334/98 de Defensa del Consumidor), and it stops working the first time
//     a returning visitor notices.
//   - A price never publishes anything. Paying (or the promotion making a
//     package free) buys the package; every listing still lands `pending` and
//     reaches the site only through /admin approval (AGENTS.md).

export const PLAN_KEYS = ['basico', 'destacado', 'empresa'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && (PLAN_KEYS as readonly string[]).includes(value);
}

export type PlanPricing = {
  key: PlanKey;
  /** The regular price, in guaraníes (no decimals exist, so an integer). */
  priceGs: number;
  /** The promotional price while a promotion runs; 0 means "gratis". */
  promoPriceGs: number | null;
  /** When the promotion ends. A promotion without one is never active. */
  promoEndsAt: Date | null;
};

export type PlanPricingTable = Record<PlanKey, PlanPricing>;

/** Spanish (Paraguay), same as every other label in this app. */
export const PLAN_LABELS: Record<PlanKey, string> = {
  basico: 'Básico',
  destacado: 'Destacado',
  empresa: 'Empresa',
};

/** What one payment buys — printed next to every price. */
export const PLAN_PERIOD: Record<PlanKey, string> = {
  basico: 'por aviso · 30 días',
  destacado: 'por aviso · 30 días',
  empresa: 'por mes',
};

/**
 * Printed before the amount. Empresa is a base price: the Meta ad campaigns
 * it includes run on the customer's own ad budget, which is theirs to set, so
 * the page never states a maximum (owner decision 2026-09-27).
 */
export const PLAN_PRICE_PREFIX: Record<PlanKey, string> = {
  basico: '',
  destacado: '',
  empresa: 'Desde ',
};

/** `Desde Gs. 1.490.000` / `Gs. 99.000` — the amount as a package is sold. */
export function formatPlanPrice(key: PlanKey, amount: number): string {
  return `${PLAN_PRICE_PREFIX[key]}${formatGs(amount)}`;
}

/**
 * The invoice line, stated once so /planes, /publicar-gratis and
 * /buscar-personal cannot word it differently. Formal companies need a
 * factura to book the expense; saying so up front is a reason to choose us
 * over an informal page. Owner decision 2026-09-27: every payment is
 * invoiced — if that ever stops being true, change it here.
 */
export const INVOICE_NOTE = 'Emitimos factura por cada pago.';

/** How many days the price covers, for the "menos de Gs. X por día" line. */
export const PLAN_DAYS: Record<PlanKey, number> = {
  basico: 30,
  destacado: 30,
  empresa: 30,
};

/** Bounded so a typo in /admin/precios cannot put a nine-digit price live. */
export const MAX_PRICE_GS = 50_000_000;

/**
 * Paraguay has been on UTC-3 all year since October 2024 (permanent DST), so
 * "the end of the day in Asunción" is a fixed offset. A promotion ends at the
 * last second of the date the admin picked, in the country the customer is in.
 */
const ASUNCION_OFFSET = '-03:00';

export function promoEndFromDateInput(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const end = new Date(`${date}T23:59:59${ASUNCION_OFFSET}`);
  return Number.isNaN(end.getTime()) ? null : end;
}

/** The inverse, for prefilling `<input type="date">` in /admin/precios. */
export function dateInputFromPromoEnd(end: Date | null): string {
  if (!end) return '';
  // en-CA formats as YYYY-MM-DD, which is exactly the input's value format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end);
}

/**
 * The launch defaults (owner decision 2026-09-27): Básico is free as a
 * time-limited promotion, the other two are paid. Used as-is until
 * /admin/precios saves a row, and in seed mode, which has no database.
 *
 * Set against the local market (owner decision 2026-09-27): social-media job
 * boards sell a 7-day post for about Gs. 35.000, so Básico stays above that
 * but reads as better value per day (30 days, searchable, reviewed); Destacado
 * stays under the Gs. 250.000 line; Empresa is a base price ("desde") that
 * includes running Meta ads on the customer's own budget. The owner changes
 * all three in /admin/precios.
 */
export const DEFAULT_PLAN_PRICING: PlanPricingTable = {
  basico: {
    key: 'basico',
    priceGs: 99_000,
    promoPriceGs: 0,
    promoEndsAt: promoEndFromDateInput('2026-10-31'),
  },
  destacado: { key: 'destacado', priceGs: 249_000, promoPriceGs: null, promoEndsAt: null },
  empresa: { key: 'empresa', priceGs: 1_490_000, promoPriceGs: null, promoEndsAt: null },
};

export type ActivePromo = { priceGs: number; endsAt: Date };

/**
 * The promotion in force at `now`, or null. Requires a promotional price that
 * is actually lower than the regular one and an end date still in the future —
 * anything else is not a promotion and is never shown as one.
 */
export function activePromo(plan: PlanPricing, now: Date = new Date()): ActivePromo | null {
  if (plan.promoPriceGs === null || !plan.promoEndsAt) return null;
  if (plan.promoPriceGs >= plan.priceGs) return null;
  if (plan.promoEndsAt.getTime() <= now.getTime()) return null;
  return { priceGs: plan.promoPriceGs, endsAt: plan.promoEndsAt };
}

/** What the package costs at `now`: the promotional price while one runs. */
export function currentPriceGs(plan: PlanPricing, now: Date = new Date()): number {
  return activePromo(plan, now)?.priceGs ?? plan.priceGs;
}

/** Is publishing a standard listing free right now? The site's headline question. */
export function publishingIsFree(table: PlanPricingTable, now: Date = new Date()): boolean {
  return currentPriceGs(table.basico, now) === 0;
}

/** `Gs. 149.000` — the dot thousands separator Paraguay uses. */
export function formatGs(amount: number): string {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Gs. ${digits}`;
}

/** `Gratis` for 0, `Gs. 149.000` otherwise. */
export function formatPrice(amount: number): string {
  return amount === 0 ? 'Gratis' : formatGs(amount);
}

/** `31 de octubre`, in Asunción time. */
export function formatPromoEnd(end: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: 'numeric',
    month: 'long',
  }).format(end);
}

/**
 * Whole days left, counting today, for "Quedan 5 días". 1 on the last day, so
 * the copy never says "Quedan 0 días" while the offer is still valid.
 */
export function promoDaysLeft(end: Date, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Price per day, rounded UP to the nearest 100 so "menos de Gs. 11.700 por día" stays true. */
export function pricePerDayGs(plan: PlanPricing): number {
  return Math.ceil(plan.priceGs / PLAN_DAYS[plan.key] / 100) * 100;
}

export type PlanPricingInput = {
  key: PlanKey;
  priceGs: number;
  promo: { priceGs: number; endsOn: string } | null;
};

/**
 * The one validation of what /admin/precios may save, shared by the form (to
 * say what is wrong before a round trip) and the route handler (which is the
 * actual gate). Returns Spanish messages; an empty array means valid.
 */
export function validatePlanPricing(input: PlanPricingInput, now: Date = new Date()): string[] {
  const label = PLAN_LABELS[input.key];
  const errors: string[] = [];
  const isAmount = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_PRICE_GS;
  if (!isAmount(input.priceGs) || input.priceGs === 0) {
    errors.push(`${label}: el precio regular tiene que ser un monto mayor a 0.`);
  }
  if (input.promo) {
    if (!isAmount(input.promo.priceGs) || input.promo.priceGs >= input.priceGs) {
      errors.push(`${label}: el precio de promoción tiene que ser menor al regular (0 = gratis).`);
    }
    const end = promoEndFromDateInput(input.promo.endsOn);
    if (!end) {
      errors.push(`${label}: elegí la fecha en que termina la promoción.`);
    } else if (end.getTime() <= now.getTime()) {
      errors.push(`${label}: la fecha de fin de la promoción ya pasó.`);
    }
  }
  return errors;
}
