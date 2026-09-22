// The two writes behind the employer "¿Olvidaste tu contraseña?" flow
// (app/api/empresa/recuperar/*). The users-side twin of what
// lib/db/candidate-profile.ts does for candidates.
//
// Employers only. Admin and editor accounts keep `npm run user:password`: a
// staff credential reset by email would make the staff inbox a way into
// /admin, and there are two staff accounts, not two hundred.
import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

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
 * Sets the new hash and burns every outstanding token of the account — including
 * a reset link someone else requested minutes earlier — in the same call, so
 * "password changed" and "old links dead" cannot drift apart. Scoped to the
 * employer role in the WHERE, like the lookup above.
 */
export async function setEmployerPassword(userId: number, passwordHash: string): Promise<boolean> {
  const db = await getDb();
  const now = new Date();
  const [result] = await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(and(eq(users.id, userId), eq(users.role, 'employer'), eq(users.isActive, true)));
  if (result.affectedRows === 0) return false;
  await db
    .update(userTokens)
    .set({ usedAt: now })
    .where(and(eq(userTokens.userId, userId), isNull(userTokens.usedAt)));
  return true;
}
