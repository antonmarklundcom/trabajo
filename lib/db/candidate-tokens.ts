// Issue and redeem the single-use tokens behind email verification and password
// reset (PLAN-NEXT.md §2 E1).
//
// Everything that makes these tokens safe lives here, so there is one place to
// read when the question is "can this link be replayed?":
//
//   - 32 bytes of CSPRNG randomness, so guessing is not a strategy;
//   - only the sha256 is stored, so a leaked database row cannot be redeemed;
//   - single use, enforced by `usedAt` on redemption;
//   - time-limited, checked at redemption rather than trusted from the link;
//   - issuing a new token of a purpose invalidates that candidate's outstanding
//     ones, so a reset link mailed to an address the candidate no longer
//     controls stops working the moment they ask for another.
import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';

import { candidateTokens, type candidateTokenPurposeEnum } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type CandidateTokenPurpose = (typeof candidateTokenPurposeEnum)[number];

/** 30 minutes. Long enough to walk to a phone, short enough to matter. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
/** Verification is not urgent and not a credential — a day is friendlier. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Mints a token, stores only its hash, returns the raw value for the email.
 *
 * The raw token is returned once and never again — it is not recoverable from
 * the row, which is the entire point.
 */
export async function issueCandidateToken(
  candidateId: number,
  purpose: CandidateTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const db = await getDb();
  const raw = randomBytes(32).toString('base64url');
  const now = new Date();

  // Supersede the candidate's outstanding tokens of this purpose. Marking them
  // used rather than deleting keeps the trail of how many were requested, which
  // is the shape of an attack when it happens.
  await db
    .update(candidateTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(candidateTokens.candidateId, candidateId),
        eq(candidateTokens.purpose, purpose),
        isNull(candidateTokens.usedAt),
      ),
    );

  await db.insert(candidateTokens).values({
    candidateId,
    purpose,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now.getTime() + ttlMs),
    createdAt: now,
  });

  return raw;
}

export type RedeemResult =
  | { ok: true; candidateId: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Consumes a token, or explains why it could not.
 *
 * The reasons are distinguished on purpose. A candidate who clicks yesterday's
 * link deserves "this link expired, ask for another" rather than the same
 * message a forged token gets — and unlike login, saying so leaks nothing: the
 * holder of the raw token already proved they received the email.
 */
export async function redeemCandidateToken(
  raw: string,
  purpose: CandidateTokenPurpose,
): Promise<RedeemResult> {
  if (!raw) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const digest = hashToken(raw);

  const [row] = await db
    .select({
      id: candidateTokens.id,
      candidateId: candidateTokens.candidateId,
      tokenHash: candidateTokens.tokenHash,
      expiresAt: candidateTokens.expiresAt,
      usedAt: candidateTokens.usedAt,
    })
    .from(candidateTokens)
    .where(and(eq(candidateTokens.tokenHash, digest), eq(candidateTokens.purpose, purpose)))
    .limit(1);

  if (!row) return { ok: false, reason: 'invalid' };

  // The lookup above already matched on the hash, so this is belt-and-braces
  // rather than the primary defence — but a constant-time compare costs
  // nothing and keeps the property true if the lookup is ever loosened.
  if (!constantTimeEquals(row.tokenHash, digest)) return { ok: false, reason: 'invalid' };

  if (row.usedAt) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Conditional update: `used_at IS NULL` in the WHERE makes redemption itself
  // the race guard, so two simultaneous clicks cannot both succeed.
  const [result] = await db
    .update(candidateTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(candidateTokens.id, row.id), isNull(candidateTokens.usedAt)));

  if (result.affectedRows === 0) return { ok: false, reason: 'used' };

  return { ok: true, candidateId: row.candidateId };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Used by the ARCO purge and by a password change, which both invalidate. */
export async function invalidateCandidateTokens(candidateId: number): Promise<number> {
  const db = await getDb();
  const [result] = await db
    .delete(candidateTokens)
    .where(eq(candidateTokens.candidateId, candidateId));
  return result.affectedRows;
}
