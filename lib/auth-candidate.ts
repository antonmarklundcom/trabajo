// Candidate auth — a SEPARATE auth surface from /admin (PLAN-PHASE2.md §2.1).
//
// Why this is its own module and its own table rather than a fourth value in
// users.role: every existing guard, every admin list query and every
// requireRole() call in this repo is written against `users`. Adding a role
// means auditing all of them, and the failure mode of missing one is a job
// seeker inside the admin panel. Two tables make that class of bug structurally
// impossible instead of conditionally absent — a candidate session cannot
// satisfy a `users`-based guard because it resolves against a different table.
//
// The cost is this file: a second session implementation. It deliberately
// mirrors lib/auth.ts rather than abstracting over it, because the one thing
// these two must never accidentally share is the answer to "who is this?".
// What they DO share (bcrypt cost, the dummy hash, the rate-limiter code) is
// imported, so those cannot drift.
//
// Same Next 16 constraints as lib/auth.ts, verified against
// node_modules/next/dist/docs: `cookies()` is async; cookies may only be
// WRITTEN from a Server Function or Route Handler, so the read path never
// calls save(); Proxy (middleware) is for optimistic checks only, never the
// sole authorization layer.
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession, type SessionOptions } from 'iron-session';

import { AuthError, DUMMY_HASH, hashPassword, verifyPassword } from './auth';
import { createAttemptLimiter, LOGIN_LIMITS } from './rate-limit';

/**
 * What the encrypted candidate cookie carries.
 *
 * `kind` is a discriminator, not decoration. Both cookies are sealed with the
 * same SESSION_SECRET, so a candidate cookie value pasted into the staff cookie
 * name would decrypt successfully. It would carry no `userId`, so the staff
 * path already resolves it to null — and this field makes the reverse direction
 * fail just as closed instead of relying on that asymmetry.
 */
export type CandidateSessionData = {
  candidateId?: number;
  kind?: 'candidate';
};

/** The request-scoped candidate, loaded fresh from the DB. Never the hash. */
export type CandidateUser = {
  id: number;
  email: string;
  name: string;
  phone: string;
  cityId: number | null;
  headline: string | null;
  emailVerifiedAt: Date | null;
  notifyOnStatusChange: boolean;
};

export const CANDIDATE_COOKIE_NAME = 'trabajo_postulante';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — a job hunt is long
export const CANDIDATE_LOGIN_PATH = '/postulante/login';

async function getDb() {
  // Lazy, exactly as in lib/auth.ts: lib/db/index.ts builds its pool at module
  // evaluation, so a static import would break any path without DATABASE_URL,
  // including the public site on DATA_SOURCE=seed.
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/schema')]);
  return { db, schema };
}

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 32` ' +
        'and set it in .env locally / hPanel in production (see .env.example).',
    );
  }

  return {
    cookieName: CANDIDATE_COOKIE_NAME,
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<CandidateSessionData>(cookieStore, sessionOptions());
}

// ---------------------------------------------------------------------------
// Reading the current candidate
// ---------------------------------------------------------------------------

/**
 * The current candidate, or null. Memoized per request with React `cache()` so
 * a page and its data calls share one DB read rather than hammering the
 * 8-connection pool.
 *
 * Returns null rather than throwing: /empleos/[slug] renders for anonymous
 * visitors and logged-in candidates alike, and only the apply button differs.
 */
export const getCandidate = cache(async (): Promise<CandidateUser | null> => {
  const session = await getSession();
  if (session.kind !== 'candidate' || !session.candidateId) return null;

  const { db, schema } = await getDb();
  const { eq, and } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: schema.candidates.id,
      email: schema.candidates.email,
      name: schema.candidates.name,
      phone: schema.candidates.phone,
      cityId: schema.candidates.cityId,
      headline: schema.candidates.headline,
      emailVerifiedAt: schema.candidates.emailVerifiedAt,
      notifyOnStatusChange: schema.candidates.notifyOnStatusChange,
    })
    .from(schema.candidates)
    // isActive is part of the lookup rather than a post-check, and a deleted
    // candidate has no row at all — the ARCO purge is a hard delete
    // (PLAN-PHASE2.md §4.4), so this returns null the moment it runs.
    .where(and(eq(schema.candidates.id, session.candidateId), eq(schema.candidates.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Page/Server-Function guard: the candidate, or a redirect to their login. */
export async function requireCandidate(): Promise<CandidateUser> {
  const candidate = await getCandidate();
  if (!candidate) redirect(CANDIDATE_LOGIN_PATH);
  return candidate;
}

/**
 * Route-handler guard: throws AuthError(401) instead of redirecting. Pairs with
 * the existing authErrorResponse() from lib/auth.ts, so candidate handlers
 * report failures exactly like admin ones do.
 */
export async function requireApiCandidate(): Promise<CandidateUser> {
  const candidate = await getCandidate();
  if (!candidate) throw new AuthError(401, 'Authentication required.');
  return candidate;
}

// ---------------------------------------------------------------------------
// Login / logout — Route Handlers and Server Functions ONLY (they write
// cookies, which Next 16 forbids during Server Component render).
// ---------------------------------------------------------------------------

export async function createCandidateSession(candidateId: number): Promise<void> {
  const session = await getSession();
  session.candidateId = candidateId;
  session.kind = 'candidate';
  await session.save();
}

export async function destroyCandidateSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

// ---------------------------------------------------------------------------
// Passwords / authentication
// ---------------------------------------------------------------------------

/** Re-exported so callers never reach for bcrypt directly and pick a cost. */
export { hashPassword };

/**
 * Looks the candidate up, checks the password in constant-ish time, creates
 * nothing. Returns null on ANY failure — unknown email, wrong password,
 * disabled account — so the caller cannot leak which one it was.
 *
 * Rate limiting is the caller's job (checkCandidateLoginRateLimit), because
 * only the route handler knows the client IP.
 */
export async function authenticateCandidate(
  email: string,
  password: string,
): Promise<CandidateUser | null> {
  const { db, schema } = await getDb();
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: schema.candidates.id,
      email: schema.candidates.email,
      name: schema.candidates.name,
      phone: schema.candidates.phone,
      cityId: schema.candidates.cityId,
      headline: schema.candidates.headline,
      emailVerifiedAt: schema.candidates.emailVerifiedAt,
      notifyOnStatusChange: schema.candidates.notifyOnStatusChange,
      isActive: schema.candidates.isActive,
      passwordHash: schema.candidates.passwordHash,
    })
    .from(schema.candidates)
    .where(eq(schema.candidates.email, email.trim().toLowerCase()))
    .limit(1);

  const row = rows[0];

  // Always compare, even with no row, so a wrong email and a wrong password
  // cost the same ~270ms and response latency does not enumerate accounts.
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok || !row.isActive) return null;

  await db
    .update(schema.candidates)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.candidates.id, row.id));

  // Built field by field rather than by spreading `row`: the hash must not
  // reach a caller by being forgotten in a rest object when a column is added.
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    cityId: row.cityId,
    headline: row.headline,
    emailVerifiedAt: row.emailVerifiedAt,
    notifyOnStatusChange: row.notifyOnStatusChange,
  };
}

// ---------------------------------------------------------------------------
// Rate limiting — a separate budget from staff logins, same implementation.
// ---------------------------------------------------------------------------

const candidateLoginLimiter = createAttemptLimiter(LOGIN_LIMITS);

export function checkCandidateLoginRateLimit(
  ip: string,
  email: string,
): { allowed: boolean; retryAfterSeconds: number } {
  return candidateLoginLimiter.check(ip, email);
}

export function recordFailedCandidateLogin(ip: string, email: string): void {
  candidateLoginLimiter.recordFailure(ip, email);
}

export function clearCandidateLoginAttempts(ip: string, email: string): void {
  candidateLoginLimiter.clear(ip, email);
}

// A SECOND instance, not the login one. The ARCO deletion page re-checks the
// password, and until B1 it called the login limiter: five mistyped
// confirmations there locked the account out of logging in, and five failed
// logins locked the account out of deleting itself (PLAN-PHASE3-DRAFT.md
// §13.3). Self-service deletion is what /privacidad promises, so it does not
// share a budget with anything else.
const candidateDeletionLimiter = createAttemptLimiter(LOGIN_LIMITS);

export function checkCandidateDeletionRateLimit(
  ip: string,
  email: string,
): { allowed: boolean; retryAfterSeconds: number } {
  return candidateDeletionLimiter.check(ip, email);
}

export function recordFailedCandidateDeletion(ip: string, email: string): void {
  candidateDeletionLimiter.recordFailure(ip, email);
}

export function clearCandidateDeletionAttempts(ip: string, email: string): void {
  candidateDeletionLimiter.clear(ip, email);
}

// A THIRD instance, for password-reset requests (PLAN-NEXT.md §2 E1). Same
// reasoning as the deletion limiter: the reset form is an unauthenticated
// endpoint that anyone can point at any address, and it must not be able to
// spend the budget that stops credential stuffing against that account's login.
//
// There is no `clear` here on purpose. A reset request has no success the user
// proves in the moment — the proof arrives later, in the inbox — so there is
// nothing that should hand the budget back.
const candidateResetLimiter = createAttemptLimiter(LOGIN_LIMITS);

export function checkCandidateResetRateLimit(
  ip: string,
  email: string,
): { allowed: boolean; retryAfterSeconds: number } {
  return candidateResetLimiter.check(ip, email);
}

export function recordCandidateResetRequest(ip: string, email: string): void {
  candidateResetLimiter.recordFailure(ip, email);
}
