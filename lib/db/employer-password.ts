// The two writes behind the employer "¿Olvidaste tu contraseña?" flow
// (app/api/empresa/recuperar/*). The users-side twin of what
// lib/db/candidate-profile.ts does for candidates.
//
// Employers only. Admin and editor accounts keep `npm run user:password`: a
// staff credential reset by email would make the staff inbox a way into
// /admin, and there are two staff accounts, not two hundred.
import 'server-only';

import { and, eq, isNull, sql } from 'drizzle-orm';

import { users, userTokens } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

/** An active employer account for this address, or null. Never staff. */
export async function findActiveEmployerByEmail(
  email: string,
): Promise<{ id: number; email: string; name: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.email, email.trim().toLowerCase()),
        eq(users.role, 'employer'),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Sets the new hash, ends every existing session, and burns every outstanding
 * token of the account — including a reset link someone else requested minutes
 * earlier — in one transaction, so "password changed", "old sessions dead" and
 * "old links dead" cannot drift apart. Scoped to the employer role in the
 * WHERE, like the lookup above.
 *
 * `session_version` is incremented in the SAME UPDATE that writes the hash
 * (lib/auth.ts SessionData explains the mechanism). A separate statement would
 * reopen the very gap this closes: a crash between the two leaves a changed
 * password and a still-valid attacker cookie.
 *
 * Returns the account's new session version, for the caller to seal into the
 * cookie it issues next, or null when no active employer row matched. MySQL
 * has no RETURNING, so the value is read back inside the transaction, where the
 * UPDATE's row lock guarantees it is this write's result and not a concurrent
 * one's.
 */
export async function setEmployerPassword(
  userId: number,
  passwordHash: string,
): Promise<number | null> {
  const db = await getDb();
  const now = new Date();
  return db.transaction(async (tx) => {
    const [result] = await tx
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now })
      .where(and(eq(users.id, userId), eq(users.role, 'employer'), eq(users.isActive, true)));
    if (result.affectedRows === 0) return null;

    const [row] = await tx
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    // Unreachable (the UPDATE just matched this row), but if it ever were, a
    // throw rolls the hash back rather than committing a password change the
    // caller would then report as a dead link.
    if (!row) throw new Error(`setEmployerPassword: user ${userId} vanished mid-transaction`);

    await tx
      .update(userTokens)
      .set({ usedAt: now })
      .where(and(eq(userTokens.userId, userId), isNull(userTokens.usedAt)));

    return row.sessionVersion;
  });
}
