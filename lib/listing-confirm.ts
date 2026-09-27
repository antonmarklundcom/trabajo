// "¿Tu aviso sigue abierto?" — the signed one-click links in the listing
// confirmation email (scripts/listing-confirm.ts sends it; /empresa/confirmar-
// aviso redeems it).
//
// Stateless by design: no token table and no migration. A link is an HMAC over
// what it may do, and the database row it acts on is what makes it single-use:
//
//   payload = { jobId, action, expiresAt, issuedAt }
//   sig     = HMAC-SHA256(key, "listing-confirm:v1|jobId|action|expiresAtIso|issuedAtIso")
//   key     = HMAC-SHA256(SESSION_SECRET, "listing-confirm")
//
//   - `expiresAt` is the job's `expires_at` AT THE TIME OF SENDING. The redeem
//     path only acts while the row still carries exactly that value (it is in
//     the UPDATE's WHERE clause, not just a preceding read), so the first click
//     that renews or closes the listing changes the row and every other link
//     in that email — including a mail scanner's replay — stops matching.
//   - `issuedAt` caps a link's life at LISTING_CONFIRM_TOKEN_TTL_MS whatever the
//     row says, so a forwarded email does not stay a remote control for ever.
//   - The key is DERIVED rather than SESSION_SECRET itself: a MAC computed for
//     this purpose can never be replayed as, or confused with, anything
//     iron-session produces from the same secret.
//
// What a valid token authorizes is deliberately small: renew one published
// listing by LISTING_DAYS, or archive it. It never publishes anything, never
// touches `featured_until`, and cannot be minted by anyone who does not hold
// SESSION_SECRET. The possession of the email is the authorization, the same
// model as the password-reset link.
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export const LISTING_CONFIRM_ACTIONS = ['open', 'close'] as const;
export type ListingConfirmAction = (typeof LISTING_CONFIRM_ACTIONS)[number];

/** A link is never honoured more than this long after it was issued. */
export const LISTING_CONFIRM_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Tolerated clock difference between the machine that sent and the server. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** activity_log actions this feature writes (entity_type 'job'). */
export const LISTING_CONFIRM_LOG = {
  sent: 'listing_confirm_sent',
  open: 'listing_confirm_open',
  close: 'listing_confirm_close',
} as const;

export type ListingConfirmPayload = {
  jobId: number;
  action: ListingConfirmAction;
  /** The job's `expires_at` when the link was minted. Whole seconds (DATETIME). */
  expiresAt: Date;
  issuedAt: Date;
};

export type ListingConfirmVerdict =
  | { ok: true; payload: ListingConfirmPayload }
  | { ok: false; reason: 'invalid' | 'expired' };

/**
 * The purpose-specific key. Throws on a missing or short SESSION_SECRET with
 * the same message lib/auth.ts gives, because an unset secret here would mean
 * every link in a batch of emails is unverifiable.
 */
export function listingConfirmKey(secret: string | undefined = process.env.SESSION_SECRET): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. The listing confirmation links are ' +
        'signed with a key derived from it, and must be signed with the SAME value production uses.',
    );
  }
  return createHmac('sha256', secret).update('listing-confirm').digest();
}

/**
 * A short, non-secret fingerprint of the derived key. The script prints it and
 * /admin shows it: links minted on a laptop whose SESSION_SECRET differs from
 * production's are all invalid, and nothing else would reveal that before an
 * employer clicks one.
 */
export function listingConfirmKeyFingerprint(key: Buffer = listingConfirmKey()): string {
  return createHmac('sha256', key).update('fingerprint').digest('hex').slice(0, 8);
}

function toSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function macInput(jobId: number, action: ListingConfirmAction, expiresSec: number, issuedSec: number): string {
  return [
    'listing-confirm:v1',
    String(jobId),
    action,
    new Date(expiresSec * 1000).toISOString(),
    new Date(issuedSec * 1000).toISOString(),
  ].join('|');
}

function mac(key: Buffer, input: string): Buffer {
  return createHmac('sha256', key).update(input).digest();
}

/** `{jobId}.{action}.{expiresAtSec}.{issuedAtSec}.{sig}` — URL-safe as is. */
export function signListingConfirmToken(payload: ListingConfirmPayload, key: Buffer = listingConfirmKey()): string {
  const expiresSec = toSeconds(payload.expiresAt);
  const issuedSec = toSeconds(payload.issuedAt);
  const sig = mac(key, macInput(payload.jobId, payload.action, expiresSec, issuedSec)).toString('base64url');
  return [payload.jobId, payload.action, expiresSec, issuedSec, sig].join('.');
}

const TOKEN_SHAPE = /^([1-9]\d{0,9})\.(open|close)\.(\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

/**
 * Checks the signature (constant-time) and the token's age. Pure: it does not
 * know what the job row currently says — the caller compares `expiresAt`
 * against the row, and the write compares it again in its WHERE clause.
 */
export function verifyListingConfirmToken(
  token: string,
  now: Date = new Date(),
  key: Buffer = listingConfirmKey(),
): ListingConfirmVerdict {
  const match = TOKEN_SHAPE.exec(token);
  if (!match) return { ok: false, reason: 'invalid' };

  const jobId = Number(match[1]);
  const action = match[2] as ListingConfirmAction;
  const expiresSec = Number(match[3]);
  const issuedSec = Number(match[4]);

  const expected = mac(key, macInput(jobId, action, expiresSec, issuedSec));
  const given = Buffer.from(match[5], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'invalid' };
  }

  const issuedMs = issuedSec * 1000;
  if (issuedMs > now.getTime() + CLOCK_SKEW_MS) return { ok: false, reason: 'invalid' };
  if (now.getTime() - issuedMs > LISTING_CONFIRM_TOKEN_TTL_MS) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    payload: { jobId, action, expiresAt: new Date(expiresSec * 1000), issuedAt: new Date(issuedMs) },
  };
}

/** Whether a row's current `expires_at` is the one a token was minted for. */
export function sameExpiry(current: Date | null, signed: Date): boolean {
  return current !== null && toSeconds(current) === toSeconds(signed);
}

/** Dates in these emails and pages are Paraguayan dates, wherever the sender runs. */
export function formatListingDate(date: Date): string {
  return date.toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Asuncion',
  });
}
