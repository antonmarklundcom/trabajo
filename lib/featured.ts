// The Destacado product: what may be sold, and how the window is computed.
//
// NOT `server-only`, deliberately — components/admin/FeaturePanel.tsx renders
// the duration buttons and the payment-method select from these lists, and
// lib/db/admin.ts validates against the same ones. The same reasoning as
// lib/leads.ts holding the Zod schema that components/EmployerForm.tsx imports:
// when a client offers a choice and a server accepts it, one list is the only
// way they cannot drift.
//
// The arithmetic is here rather than inline in the grant so it is a pure
// function of (now, current window, days) with no database in the way —
// scripts/verify-featured.ts evaluates it directly, including the two cases
// that are easy to get wrong: renewing a window that is still open must ADD to
// it, and "extending" one that already lapsed must start from now rather than
// back-date the new window into the past.

/** What a Destacado may be sold for. Bounded so a typo cannot sell a decade. */
export const FEATURE_DURATION_DAYS = [15, 30, 60, 90] as const;
export type FeatureDurationDays = (typeof FEATURE_DURATION_DAYS)[number];

export const FEATURE_PAYMENT_METHODS = ['transferencia', 'efectivo', 'giro', 'otro'] as const;
export type FeaturePaymentMethod = (typeof FEATURE_PAYMENT_METHODS)[number];

/** Spanish (Paraguay), same as every other label in this app. */
export const FEATURE_PAYMENT_LABELS: Record<FeaturePaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  giro: 'Giro',
  otro: 'Otro',
};

/**
 * The launch promotion (PLAN-GROWTH.md §4 Batch P, §7 D15): the first 100
 * approved listings get Destacado for 90 days, free.
 *
 * Here rather than in lib/promo.ts because both sides need it and only one of
 * them may be `server-only`: lib/db/admin.ts writes the channel, the admin
 * client components render the quota, and lib/promo.ts counts against it. Same
 * reasoning as the duration and payment lists above.
 *
 * `days` is typed as a FeatureDurationDays, not a loose number: the promotion
 * grants through the same bounded list every sale does, so a typo here is a
 * type error rather than a comped decade.
 */
export const LAUNCH_PROMO: { quota: number; days: FeatureDurationDays } = {
  quota: 100,
  days: 90,
};

/** The grant channel a promo window records. Mirrored in FEATURE_GRANT_CHANNELS. */
export const LAUNCH_PROMO_CHANNEL = 'promo_launch';

/** Spanish (Paraguay), for the admin surfaces that name how a window opened. */
export const FEATURE_GRANT_CHANNEL_LABELS: Record<string, string> = {
  whatsapp_manual: 'Venta por WhatsApp',
  pagopar: 'Pago en línea',
  promo_launch: 'Promoción de lanzamiento',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFeatureDuration(value: number): value is FeatureDurationDays {
  return (FEATURE_DURATION_DAYS as readonly number[]).includes(value);
}

/**
 * The end of the window a grant produces.
 *
 * `extend` adds the days to a window that is still OPEN. Anything else — no
 * previous window, a lapsed one, or `extend: false` — starts a fresh window
 * from `now`. Renewing an active listing mid-window must not shorten it, which
 * is exactly what "featured_until = now + days" would do to a customer with 20
 * days left; and extending a window that closed last month must not produce a
 * date that is still in the past.
 */
export function computeFeaturedUntil(
  now: Date,
  currentFeaturedUntil: Date | null,
  days: FeatureDurationDays,
  extend: boolean,
): Date {
  const open =
    extend && currentFeaturedUntil && currentFeaturedUntil.getTime() > now.getTime()
      ? currentFeaturedUntil
      : now;
  return new Date(open.getTime() + days * DAY_MS);
}
