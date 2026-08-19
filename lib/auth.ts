// Auth core: session, password hashing, authorization guards.
//
// Written against node_modules/next/dist/docs (Next 16), not from memory —
// several things differ from older App Router material:
//   - `cookies()` is async and must be awaited.
//   - Cookies can only be WRITTEN from a Server Function or Route Handler.
//     Reading works anywhere, so the read path below never calls `save()`.
//   - Middleware is now "Proxy" (proxy.ts), and the docs are explicit that it
//     is for optimistic checks only, never the sole authorization layer. Hence
//     this module is the Data Access Layer every guard goes through.
//   - `forbidden()` / `unauthorized()` exist but are experimental behind
//     `experimental.authInterrupts`. This repo auto-deploys `main` to
//     production with no staging, so they are deliberately not used.
//
// Design rules from ARCHITECTURE.md §5:
//   - The cookie holds ONLY `userId`. Role and active-status are read from the
//     DB on every request, so demoting or disabling a user takes effect
//     immediately rather than whenever their cookie happens to expire.
//   - bcrypt cost 12.
//   - Every mutating handler re-checks authorization server-side.
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession, type SessionOptions } from 'iron-session';

export type Role = 'admin' | 'editor' | 'employer';

/** What the encrypted cookie carries. Deliberately nothing but the id. */
export type SessionData = {
  userId?: number;
};

/** The request-scoped user, loaded fresh from the DB. Never the password hash. */
export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  companyId: number | null;
};

export const SESSION_COOKIE_NAME = 'trabajo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const BCRYPT_COST = 12;

export const LOGIN_PATH = '/admin/login';
export const EMPLOYER_LOGIN_PATH = '/empresa/login';

/**
 * Where a user belongs after logging in, and where a wrong-role redirect sends
 * them. Employers share this table and this cookie with staff but never share
 * a route tree (PLAN-PHASE2.md §2.1), so every redirect that used to be a
 * hardcoded '/admin' has to go through here — sending an employer to '/admin'
 * would bounce them straight back out and loop.
 */
export function homePathForRole(role: Role): string {
  return role === 'employer' ? '/empresa' : '/admin';
}

// ---------------------------------------------------------------------------
// Lazy module loading
//
// lib/db/index.ts builds its connection pool at module-evaluation time, so a
// static import here would crash any build or request path that has no
// DATABASE_URL — including the public site running on DATA_SOURCE=seed.
// lib/data.ts avoids this the same way. Same reasoning for reading
// SESSION_SECRET inside the function rather than at module scope.
// ---------------------------------------------------------------------------

async function getDb() {
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/schema')]);
  return { db, schema };
}

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    // iron-session enforces >= 32 chars itself, but its message does not say
    // which variable is at fault or where the value belongs.
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 32` ' +
        'and set it in .env locally / hPanel in production (see .env.example).',
    );
  }

  return {
    cookieName: SESSION_COOKIE_NAME,
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      // Hostinger terminates TLS in front of the app; NODE_ENV is the only
      // reliable signal here. Local http:// dev would break under `secure`.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

async function getSession() {
  const cookieStore = await cookies();
  // iron-session only touches cookieStore.set() from save()/destroy(), so this
  // is safe to call during Server Component render where the store is
  // read-only. Do not call save() from a component.
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

// ---------------------------------------------------------------------------
// Reading the current user
// ---------------------------------------------------------------------------

/**
 * The current user, or null. Memoized per render pass / request with React
 * `cache()` so that a page, its layout and its data calls share one DB read
 * instead of hammering the 8-connection pool.
 *
 * Returns null — never throws or redirects — so callers that need to render
 * something for anonymous visitors can. Guards below build on it.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  const userId = session.userId;
  if (!userId) return null;

  const { db, schema } = await getDb();
  const { eq, and } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      companyId: schema.users.companyId,
    })
    .from(schema.users)
    // isActive is part of the lookup, not a post-check: a disabled user must
    // stop authenticating the moment the flag flips, without needing their
    // cookie to expire.
    .where(and(eq(schema.users.id, userId), eq(schema.users.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
});

// ---------------------------------------------------------------------------
// Guards — page / Server Function layer (redirecting)
// ---------------------------------------------------------------------------

/**
 * Returns the current user or redirects to the login page.
 * For pages, layouts and Server Functions. ARCHITECTURE.md §5.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * Asserts the user holds one of `roles`. Throws AuthError(403) — shared by the
 * page and API layers, matching the ARCHITECTURE.md §5 snippet:
 *
 *   const session = await requireSession();
 *   requireRole(session, ['admin', 'editor']);
 */
export function requireRole(user: SessionUser, roles: readonly Role[]): void {
  if (!roles.includes(user.role)) {
    throw new AuthError(403, `Role "${user.role}" is not allowed here.`);
  }
}

/**
 * Page-layer convenience: authenticate, then authorize, redirecting rather
 * than throwing. An authenticated user with the wrong role goes to their own
 * home, not the login form — bouncing them to a login they already passed
 * reads as a broken app.
 */
export async function requireSessionWithRole(roles: readonly Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}

// ---------------------------------------------------------------------------
// Company scoping (PLAN-PHASE2.md §2.3)
//
// The risk these two guards exist for is not an unauthorized write — every
// mutating handler already re-checks its role — it is a READ that returns
// another company's applicants. So they return the `companyId` that every
// function in lib/db/employer.ts requires as its first argument, rather than
// leaving each caller to fish it off the session and possibly forget.
//
// Both fail closed on an employer whose company_id is NULL. A misconfigured
// account must see nothing, not everything: a query with `WHERE company_id IS
// NULL` matches no jobs, but one built from `companyId ?? undefined` would drop
// the predicate entirely and match all of them. Making that unrepresentable is
// the whole job here.
// ---------------------------------------------------------------------------

export type CompanyScope = { user: SessionUser; companyId: number };

/**
 * Route-handler guard for /api/empresa/*. Throws AuthError, so
 * authErrorResponse() maps it to 401/403 like every other admin handler.
 *
 * Note `admin` is NOT accepted here. Admin oversight uses lib/db/admin.ts,
 * which is a different module with different queries — there is deliberately no
 * "admin passes through the employer path with the filter relaxed" branch
 * anywhere in the codebase.
 */
export async function requireApiCompanyScope(): Promise<CompanyScope> {
  const user = await requireApiSession();
  if (user.role !== 'employer') {
    throw new AuthError(403, `Role "${user.role}" is not an employer.`);
  }
  if (user.companyId === null) {
    throw new AuthError(403, `Employer ${user.id} has no company assigned.`);
  }
  return { user, companyId: user.companyId };
}

/**
 * Page-layer equivalent: redirects instead of throwing. An employer with no
 * company goes back to the employer login with a reason code rather than
 * rendering an empty dashboard that looks broken; PR 4 renders that message.
 */
export async function requireCompanyScope(): Promise<CompanyScope> {
  const user = await getSessionUser();
  if (!user) redirect(EMPLOYER_LOGIN_PATH);
  if (user.role !== 'employer') redirect(homePathForRole(user.role));
  if (user.companyId === null) redirect(`${EMPLOYER_LOGIN_PATH}?error=sin_empresa`);
  return { user, companyId: user.companyId };
}

// ---------------------------------------------------------------------------
// Guards — Route Handler layer (throwing)
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Route-handler equivalent of requireSession(). Throws AuthError(401) instead
 * of redirecting, because an API client wants a status code, not HTML.
 */
export async function requireApiSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, 'Authentication required.');
  return user;
}

/**
 * Maps an AuthError to a JSON Response, or returns null if the error is
 * something else and should keep propagating. Keeps every admin handler's
 * catch block to one line and stops an auth failure being reported as a 500.
 */
export function authErrorResponse(err: unknown): Response | null {
  if (!(err instanceof AuthError)) return null;
  return Response.json(
    { error: err.status === 401 ? 'No autenticado' : 'No autorizado' },
    { status: err.status },
  );
}

// ---------------------------------------------------------------------------
// Login / logout — Route Handlers and Server Functions ONLY
//
// These write cookies, which Next 16 forbids during Server Component render.
// ---------------------------------------------------------------------------

export async function createSession(userId: number): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = (await import('bcrypt')).default;
  return bcrypt.hash(plain, BCRYPT_COST);
}

// A genuine cost-12 bcrypt hash of 32 random bytes that were never recorded,
// so nothing can match it. Compared against when the email does not exist, so
// that a wrong email and a wrong password cost the same ~270ms — otherwise
// response latency enumerates valid accounts. It must be a real hash: bcrypt
// rejects a malformed one immediately and the delay disappears.
// Exported so the candidate login path (lib/auth-candidate.ts) gets the same
// protection from one place rather than generating a second one.
export const DUMMY_HASH = '$2b$12$R8J/SwWDfFwOsEo2aDaWoudtvnrsaKTsTMSHtOkbpghdY/qY66UTS';

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = (await import('bcrypt')).default;
  return bcrypt.compare(plain, hash);
}

/**
 * The single login entry point: looks the user up, checks the password in
 * constant-ish time, and creates the session. Returns null on ANY failure —
 * unknown email, wrong password, disabled account — so the caller cannot
 * accidentally leak which one it was.
 *
 * Rate limiting is the caller's job (see `checkLoginRateLimit`), because only
 * the route handler knows the client IP.
 */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const { db, schema } = await getDb();
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      companyId: schema.users.companyId,
      isActive: schema.users.isActive,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()))
    .limit(1);

  const row = rows[0];

  // Always run a comparison, even with no row, to keep the timing flat.
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok || !row.isActive) return null;

  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, row.id));

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    companyId: row.companyId,
  };
}

// ---------------------------------------------------------------------------
// Login rate limiting
//
// The implementation moved to lib/rate-limit.ts in PR 2 so the candidate login
// path can reuse it (PLAN-PHASE2.md §2.1). Behaviour, limits and the exported
// signatures are unchanged: 5 attempts per 15 minutes, keyed on IP + email,
// in-memory and therefore per-process. This limiter instance is the staff and
// employer budget; candidates get their own, so neither audience can exhaust
// the other's.
// ---------------------------------------------------------------------------

import { createAttemptLimiter, LOGIN_LIMITS } from './rate-limit';

const staffLoginLimiter = createAttemptLimiter(LOGIN_LIMITS);

/** Call BEFORE checking the password. */
export function checkLoginRateLimit(
  ip: string,
  email: string,
): { allowed: boolean; retryAfterSeconds: number } {
  return staffLoginLimiter.check(ip, email);
}

/** Call after a failed login. */
export function recordFailedLogin(ip: string, email: string): void {
  staffLoginLimiter.recordFailure(ip, email);
}

/** Call after a successful login, so a legitimate user is not left throttled. */
export function clearLoginAttempts(ip: string, email: string): void {
  staffLoginLimiter.clear(ip, email);
}
