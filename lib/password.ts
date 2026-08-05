// Password hashing, kept free of any `next/*` import so that plain `tsx`
// scripts (scripts/create-user.ts, scripts/set-password.ts) can reuse the exact
// same cost factor and policy as the running app without pulling in
// `next/headers`, which only works inside a request context.
import bcrypt from 'bcrypt';

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordPolicy(plain: string): void {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

export async function hashPassword(plain: string): Promise<string> {
  assertPasswordPolicy(plain);
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
