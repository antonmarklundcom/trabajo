// The link token behind every job-alert email: confirm and unsubscribe.
//
// The constraint that shapes it: the weekly sender has to put a working
// unsubscribe link in EVERY email, weeks after the subscribe, and the database
// may only hold a hash of the token (a leaked row must not be a working link).
// A random token stored as a hash cannot satisfy both — the sender would have
// nothing to put in the link. So the token is DERIVED instead:
//
//   token      = base64url(HMAC-SHA256(key, "job-alert:v1:{id}:{email}"))
//   key        = HMAC-SHA256(JOB_ALERTS_SECRET, "trabajo.com.py job-alert token")
//   token_hash = sha256(token)          ← the only thing stored
//
// Anyone holding the secret can re-derive a row's token; anyone holding only
// the database cannot. The email is in the input so an id reused after a
// restore cannot resurrect an old link against a different person's alert.
//
// A dedicated secret rather than SESSION_SECRET, on purpose: the sender runs
// wherever `npm run alerts:send` is run, and it must not need the key that
// signs admin sessions; and rotating SESSION_SECRET to log everyone out must
// not silently break every unsubscribe link already sitting in an inbox.
// Rotating JOB_ALERTS_SECRET does break them — the next weekly email carries
// fresh ones, but until then an old link says "no válido". DEPLOY note in the
// PR report.
//
// Redeeming a link needs NO secret: the route hashes what it was given and
// looks the hash up. That is what keeps unsubscribe working even with the
// feature switched off (lib/flags.ts jobAlertsEnabled()).
import 'server-only';

import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Same floor as SESSION_SECRET (DEPLOY.md): 32 characters. */
export const JOB_ALERTS_SECRET_MIN_LENGTH = 32;

export function jobAlertsSecret(): string | null {
  const raw = process.env.JOB_ALERTS_SECRET;
  if (!raw || raw.length < JOB_ALERTS_SECRET_MIN_LENGTH) return null;
  return raw;
}

function derivedKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('trabajo.com.py job-alert token').digest();
}

/**
 * The raw token for one alert. Deterministic: the confirmation email and every
 * weekly email for the same row carry the same link.
 */
export function jobAlertToken(alertId: number, email: string, secret: string): string {
  return createHmac('sha256', derivedKey(secret))
    .update(`job-alert:v1:${alertId}:${email.trim().toLowerCase()}`)
    .digest('base64url');
}

/** What is stored and looked up. Never the token itself. */
export function hashJobAlertToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * The value token_hash holds for the instant between the INSERT (which is what
 * yields the id the real token is derived from) and the UPDATE that replaces it,
 * inside one transaction. A hash of 32 random bytes: unique, and the hash of a
 * value nobody has, so it can never match a link.
 */
export function placeholderTokenHash(): string {
  return hashJobAlertToken(randomBytes(32).toString('base64url'));
}

/** Shape check before any lookup: a base64url SHA-256 is 43 characters. */
export function isWellFormedJobAlertToken(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{43}$/.test(raw);
}
