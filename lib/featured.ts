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
