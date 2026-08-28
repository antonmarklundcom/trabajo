// Issue and redeem the single-use tokens mailed to a `users` address.
//
// The `users` counterpart of lib/db/candidate-tokens.ts, and deliberately a
// near-copy of it rather than a shared generic: the two tables are separate
// (schema.ts explains why), and the value of a copy here is that "can this
// link be replayed?" is answerable by reading one file per audience instead of
// by reasoning about which subject a parameterised module was called with.
//
// What makes these safe, same list as the candidate side:
//
//   - 32 bytes of CSPRNG randomness, so guessing is not a strategy;
//   - only the sha256 is stored, so a leaked database row cannot be redeemed;
//   - single use, enforced by `usedAt` on redemption;
//   - time-limited, checked at redemption rather than trusted from the link;
//   - issuing a new token of a purpose supersedes that user's outstanding
//     ones, so a link mailed to an address the account no longer controls
//     stops working the moment another is requested.
import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';

import { userTokens, type userTokenPurposeEnum } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type UserTokenPurpose = (typeof userTokenPurposeEnum)[number];

/** Verification is not urgent and not a credential — a day is friendlier. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Mints a token, stores only its hash, returns the raw value for the email.
 * The raw token is returned once and is not recoverable from the row.
 */
export async function issueUserToken(
  userId: number,
  purpose: UserTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const db = await getDb();
  const raw = randomBytes(32).toString('base64url');
  const now = new Date();

  // Supersede the user's outstanding tokens of this purpose. Marked used
  // rather than deleted, so how many were requested stays visible — which is
  // the shape of an attack when it happens.
  await db
    .update(userTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(userTokens.userId, userId),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
      ),
    );

  await db.insert(userTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now.getTime() + ttlMs),
    createdAt: now,
  });

  return raw;
}

export type RedeemResult =
  | { ok: true; userId: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Consumes a token, or explains why it could not.
 *
 * The reasons are distinguished on purpose, exactly as on the candidate side:
 * whoever holds the raw token already proved they received the email, so
 * "this link expired" leaks nothing that "this link is invalid" would not.
 */
export async function redeemUserToken(
  raw: string,
  purpose: UserTokenPurpose,
): Promise<RedeemResult> {
  if (!raw) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const digest = hashToken(raw);

  const [row] = await db
    .select({
      id: userTokens.id,
      userId: userTokens.userId,
      tokenHash: userTokens.tokenHash,
      expiresAt: userTokens.expiresAt,
      usedAt: userTokens.usedAt,
    })
    .from(userTokens)
    .where(and(eq(userTokens.tokenHash, digest), eq(userTokens.purpose, purpose)))
    .limit(1);

  if (!row) return { ok: false, reason: 'invalid' };

  // Belt-and-braces: the lookup already matched on the hash, but a constant-
  // time compare costs nothing and keeps the property true if it is loosened.
  if (!constantTimeEquals(row.tokenHash, digest)) return { ok: false, reason: 'invalid' };

  if (row.usedAt) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Conditional update: `used_at IS NULL` in the WHERE makes redemption itself
  // the race guard, so two simultaneous clicks cannot both succeed.
  const [result] = await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userTokens.id, row.id), isNull(userTokens.usedAt)));

  if (result.affectedRows === 0) return { ok: false, reason: 'used' };

  return { ok: true, userId: row.userId };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
