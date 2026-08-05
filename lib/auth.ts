// Auth core for the admin panel (ARCHITECTURE.md §5).
//
// Design rules, all deliberate:
//
// 1. The encrypted cookie holds ONLY `userId`. The role is read from the DB on
//    every request, so demoting or disabling a user takes effect immediately
//    instead of when their cookie expires.
// 2. Authorization is checked next to the data, not in `proxy.ts`. Next 16's
//    own guidance is that Proxy (the former Middleware) is for optimistic
//    checks only and must not be the only line of defense.
// 3. `cookies()` is async in this version, and cookie writes are only legal in
//    Route Handlers and Server Functions — never during Server Component
//    render. `createSession`/`destroySession` must therefore be called from a
//    route handler or server action.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { normalizeEmail, verifyPassword } from './password';

export { assertPasswordPolicy, hashPassword, normalizeEmail } from './password';

export type Role = 'admin' | 'editor' | 'employer';

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  companyId: number | null;
};

type SessionData = { userId?: number };

const COOKIE_NAME = 'trabajo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — a work shift, then re-login.

// A real bcrypt hash of a value nobody can supply. Compared against when the
// email does not exist so that login timing does not reveal which emails are
// registered.
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.eS5X6Y3G8mCyO2OWWWvHhSMhF8s7Vwm';

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    // Fail loudly at use time rather than silently issuing weak cookies.
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 32',
    );
  }
  return {
    cookieName: COOKIE_NAME,
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  };
}

async function ironSession(): Promise<IronSession<SessionData>> {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions());
}

// ---------------------------------------------------------------------------
// Reading the current user
// ---------------------------------------------------------------------------

// Memoized for the duration of one render pass / request, so a page that calls
// requireSession() in several places still issues one query.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await ironSession();
  if (!session.userId) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      companyId: users.companyId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  // Deleted or disabled between requests — the cookie is no longer enough.
  if (!row || !row.isActive) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    companyId: row.companyId,
  };
});

/** Throws AuthError(401) when there is no valid session. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, 'No autenticado');
  return user;
}

/** Throws AuthError(403) when the user's role is not allowed. */
export function requireRole(user: SessionUser, allowed: Role[]): SessionUser {
  if (!allowed.includes(user.role)) {
    throw new AuthError(403, 'No autorizado');
  }
  return user;
}

/** Convenience for mutating handlers: session + role in one call. */
export async function requireUser(allowed: Role[]): Promise<SessionUser> {
  return requireRole(await requireSession(), allowed);
}

// ---------------------------------------------------------------------------
// Login rate limiting
//
// In-memory and therefore per-process: it resets on deploy and would not be
// shared across instances. That is acceptable here — Hostinger runs this app
// as a single Node process — but it is the first thing to replace with a DB or
// Redis counter if the app is ever scaled horizontally.
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; firstAt: number }>();

function attemptKey(email: string, ip: string): string {
  return `${ip}|${normalizeEmail(email)}`;
}

function isLockedOut(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

// ---------------------------------------------------------------------------
// Login / logout
//
// Both write cookies, so both may only be called from a Route Handler or a
// Server Function — never during Server Component render.
// ---------------------------------------------------------------------------

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'invalid' | 'rate_limited' };

export async function login(
  emailInput: string,
  password: string,
  ip: string,
): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  const key = attemptKey(email, ip);

  if (isLockedOut(key)) return { ok: false, reason: 'rate_limited' };

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      companyId: users.companyId,
      isActive: users.isActive,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always run a comparison, even for unknown emails, so response time does
  // not distinguish "no such user" from "wrong password".
  const hash = row?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hash);

  if (!row || !row.isActive || !passwordOk) {
    recordFailure(key);
    return { ok: false, reason: 'invalid' };
  }

  clearFailures(key);
  await createSession(row.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id));

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      companyId: row.companyId,
    },
  };
}

export async function createSession(userId: number): Promise<void> {
  const session = await ironSession();
  session.userId = userId;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await ironSession();
  session.destroy();
}
