// Self-serve employer signup: how an `employer` account comes into existence
// WITHOUT an invitation (PLAN-PHASE2.md §8 Q2, reopened by the owner
// 2026-08-28).
//
// ===========================================================================
// WHAT THIS MODULE MUST NOT BE ABLE TO DO
//
// Q2 deferred self-serve for one concrete reason, quoted verbatim: "self-serve
// means anyone can claim a company and read its applications". That risk is
// about ATTACHMENT, not about signup. So the answer here is structural rather
// than procedural:
//
//   registerEmployer() always mints a BRAND-NEW companies row and attaches the
//   new user to that row. It has no parameter for an existing company id, it
//   never SELECTs an existing company, and there is no code path in it that
//   sets users.company_id to a company that existed before the call.
//
// Joining a company that already exists remains the exclusive job of
// lib/db/employer-invitations.ts, which requires a hashed single-use token an
// admin issued. The two provisioning paths therefore have disjoint outcomes,
// and a self-serve account can only ever read applications submitted to
// postings it created itself — all of which passed through /admin approval.
//
// The second half of the answer is that nothing here touches jobs. A
// self-serve employer posts through createEmployerJob() like an invited one,
// which hardcodes `status: 'pending'`. scripts/verify-moderation.ts asserts
// both halves mechanically.
// ===========================================================================
//
// Its own module, not lib/db/employer.ts and not lib/db/admin.ts, for exactly
// the reason employer-invitations.ts gives: this runs UNAUTHENTICATED, so it
// cannot be shaped as "every export takes companyId first" — there is no
// session and no company yet. It is account provisioning, like
// authenticate().
//
// `db` is imported lazily, same reasoning as every other lib/db/* module.
import 'server-only';

import { eq } from 'drizzle-orm';

import { activityLog, companies, consents, users } from './schema';
import { slugify, uniqueSlug } from '../slug';

async function getDb() {
  return (await import('./index')).db;
}

export type RegisterEmployerInput = {
  companyName: string;
  email: string;
  passwordHash: string;
  name: string;
  whatsapp: string | null;
  ip: string | null;
  userAgent: string | null;
};

export type RegisterEmployerResult =
  | { ok: true; userId: number; companyId: number }
  | { ok: false; reason: 'email_taken' };

async function companySlugExists(slug: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  return rows.length > 0;
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

/**
 * Creates the account, its company, and the terms-acceptance consent.
 *
 * Write order is load-bearing, and it is "reserve the identity first":
 *
 *   1. INSERT the users row with company_id NULL. `users.email` is UNIQUE, so
 *      this is what rejects a duplicate — including the one a pre-check cannot
 *      catch, where two signups for the same address race. Nothing else has
 *      been created at that point, so a rejection leaves no debris.
 *   2. INSERT the company and point the user at it.
 *
 * The ordering also decides what a crash between the two leaves behind: an
 * employer with no company, which requireCompanyScope() already fails closed
 * on (it redirects to the login with ?error=sin_empresa) rather than an
 * ownerless company that a later signup might be handed. Failing closed on a
 * half-finished write is the same choice lib/auth.ts makes about a NULL
 * company_id.
 */
export async function registerEmployer(
  input: RegisterEmployerInput,
): Promise<RegisterEmployerResult> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  // Friendly answer for the common case. The UNIQUE index below is the actual
  // guarantee — this read cannot be, because two requests can pass it at once.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: 'email_taken' };

  let userId: number;
  try {
    const [inserted] = await db.insert(users).values({
      email,
      passwordHash: input.passwordHash,
      name: input.name,
      role: 'employer',
      // NULL until the company below exists. Deliberate — see the doc comment.
      companyId: null,
      isActive: true,
      // Not verified yet. The verification email is the route handler's job
      // and is best-effort; it gates nothing (schema.ts).
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    userId = inserted.insertId;
  } catch (err) {
    if (isDuplicateKey(err)) return { ok: false, reason: 'email_taken' };
    throw err;
  }

  const companyName = input.companyName.trim();
  const slug = await uniqueSlug(slugify(companyName), (candidate) =>
    companySlugExists(candidate),
  );

  const [company] = await db.insert(companies).values({
    name: companyName,
    slug,
    whatsapp: input.whatsapp,
    ownerUserId: userId,
    // The moderation signal, not a permission (schema.ts). Nothing in the app
    // branches on it.
    createdVia: 'self_serve',
    createdAt: now,
    updatedAt: now,
  });
  const companyId = company.insertId;

  await db.update(users).set({ companyId, updatedAt: now }).where(eq(users.id, userId));

  // Same three-writes-are-one-event shape as acceptInvitation(): the account,
  // the company, and the record of what was agreed to.
  await db.insert(consents).values({
    subjectType: 'employer_user',
    subjectId: userId,
    purpose: 'terms_acceptance',
    granted: true,
    policyVersion: POLICY_VERSION,
    relatedCompanyId: companyId,
    relatedJobId: null,
    ip: input.ip,
    userAgent: input.userAgent,
    createdAt: now,
  });

  await db.insert(activityLog).values({
    actorUserId: userId,
    entityType: 'company',
    entityId: companyId,
    action: 'self_serve_signup',
    meta: { email },
    createdAt: now,
  });

  return { ok: true, userId, companyId };
}

/** Idempotent: a second redemption of a superseded link changes nothing. */
export async function markUserEmailVerified(userId: number): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .update(users)
    .set({ emailVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
}
