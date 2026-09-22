// How long a published listing stays public, and the arithmetic for renewing
// it. The single place that decides a `jobs.expires_at`, for the same reasons
// lib/featured.ts is the single place that decides a `featured_until`: a date
// computed in someone's head at the end of a WhatsApp call is the date that is
// wrong.
//
// The READ side already existed before this file: visiblePredicate() in
// lib/db/queries.ts hides a published row once `expires_at` has passed, and
// closedPredicate() serves it the tombstone (PLAN-GROWTH.md §7 D6). What was
// missing was any WRITE — nothing set the column, so /planes promised "Activo
// por 30 días" over listings that never closed, the JobPosting block carried no
// `validThrough`, and the tombstone was unreachable in practice.
//
// Not `server-only`: the admin panel and the employer dashboard render the
// state labels from here.

const DAY_MS = 24 * 60 * 60 * 1000;

/** What /planes promises for a free listing. */
export const LISTING_DAYS = 30;

/** The renewal lengths an operator may grant. A menu, not a free date. */
export const LISTING_RENEWAL_DAYS = [15, 30, 60] as const;
export type ListingRenewalDays = (typeof LISTING_RENEWAL_DAYS)[number];

export function isListingRenewalDays(value: unknown): value is ListingRenewalDays {
  return typeof value === 'number' && (LISTING_RENEWAL_DAYS as readonly number[]).includes(value);
}

/** "Vence pronto" starts this many days before expiry. */
export const EXPIRY_WARNING_DAYS = 7;

/**
 * The expiry a listing gets when it is published: LISTING_DAYS from now, but
 * never earlier than a Destacado window it already carries — a featured slot on
 * a listing nobody can see is a paid slot for nothing (the same rule
 * applyFeatureGrant() enforces from the other side).
 */
export function computeListingExpiry(now: Date, featuredUntil: Date | null): Date {
  const base = new Date(now.getTime() + LISTING_DAYS * DAY_MS);
  return featuredUntil && featuredUntil.getTime() > base.getTime() ? new Date(featuredUntil) : base;
}

/**
 * A renewal. Added to the current expiry while the listing is still open, so
 * renewing with 5 days left never shortens it; counted from now once it has
 * lapsed (or never had one), so a renewal can never land in the past.
 */
export function computeRenewedExpiry(
  now: Date,
  currentExpiresAt: Date | null,
  days: ListingRenewalDays,
): Date {
  const from =
    currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
  return new Date(from.getTime() + days * DAY_MS);
}

export type ListingExpiryState = 'none' | 'active' | 'expiring' | 'expired';

export function listingExpiryState(expiresAt: Date | string | null, now: Date = new Date()): ListingExpiryState {
  if (!expiresAt) return 'none';
  const t = new Date(expiresAt).getTime();
  if (t <= now.getTime()) return 'expired';
  if (t - now.getTime() <= EXPIRY_WARNING_DAYS * DAY_MS) return 'expiring';
  return 'active';
}

/** Whole days until `date` (negative once it has passed), rounded up. */
export function daysUntil(date: Date | string, now: Date = new Date()): number {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / DAY_MS);
}
