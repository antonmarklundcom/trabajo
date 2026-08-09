// Employer account provisioning (PLAN-PHASE2.md §2.2): how an `employer`
// row in `users` comes into existence. There is no self-serve signup — an
// account is a claim on a company's applications, and someone at the
// platform has to vouch for it.
//
// Deliberately its own module, not lib/db/admin.ts and not lib/db/employer.ts:
//   - The admin side (issuing an invitation) is invoked from /admin/empresas/
//     [id], but it creates rows in `employer_invitations`, a table neither
//     admin.ts nor employer.ts otherwise touches.
//   - The activation side (redeeming a token) runs UNAUTHENTICATED — there is
//     no session yet, so it cannot be shaped as "every export takes
//     companyId first" (lib/db/employer.ts's one rule) or as an admin-role
//     read (lib/db/admin.ts's implicit one). It is closer to lib/auth.ts's
//     authenticate(): account provisioning, not scoped data access.
//
// `db` is imported lazily, same reasoning as every other lib/db/* module:
// lib/db/index.ts opens its pool at module evaluation, and this module is
// reachable from route trees that can run with DATA_SOURCE=seed and no
// DATABASE_URL.
import 'server-only';

import { randomBytes, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { activityLog, companies, consents, employerInvitations, users } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

/** sha256 of the raw token. Only this ever reaches the database (schema.ts). */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Admin side — issuing an invitation from /admin/empresas/[id].
// ---------------------------------------------------------------------------

/**
 * Creates the invitation row and returns the RAW token — the only place it
 * ever exists outside the invite link. The caller (the route handler) must
 * show it once and never persist it; the database only ever sees the hash.
 */
export async function createEmployerInvitation(
  companyId: number,
  email: string,
  actorUserId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const now = new Date();
  const token = generateInvitationToken();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  await db.insert(employerInvitations).values({
    companyId,
    email: email.trim().toLowerCase(),
    tokenHash: hashInvitationToken(token),
    createdBy: actorUserId,
    expiresAt,
    createdAt: now,
  });

  await db.insert(activityLog).values({
    actorUserId,
    entityType: 'company',
    entityId: companyId,
    action: 'invite_employer',
    meta: { email: email.trim().toLowerCase() },
    createdAt: now,
  });

  return { token, expiresAt };
}

export async function listEmployerInvitations(companyId: number) {
  const db = await getDb();
  return db
    .select({
      id: employerInvitations.id,
      email: employerInvitations.email,
      expiresAt: employerInvitations.expiresAt,
      acceptedAt: employerInvitations.acceptedAt,
      createdAt: employerInvitations.createdAt,
    })
    .from(employerInvitations)
    .where(eq(employerInvitations.companyId, companyId))
    .orderBy(desc(employerInvitations.createdAt));
}

// ---------------------------------------------------------------------------
// Public side — redeeming a token at /empresa/activar. No session exists yet.
// ---------------------------------------------------------------------------

export type PendingInvitation = {
  id: number;
  companyId: number;
  companyName: string;
  email: string;
};

/** Looks up an unexpired, unaccepted invitation by its RAW token. */
export async function getInvitationByToken(token: string): Promise<PendingInvitation | null> {
  const db = await getDb();
  const now = new Date();

  const rows = await db
    .select({
      id: employerInvitations.id,
      companyId: employerInvitations.companyId,
      companyName: companies.name,
      email: employerInvitations.email,
    })
    .from(employerInvitations)
    .innerJoin(companies, eq(employerInvitations.companyId, companies.id))
    .where(
      and(
        eq(employerInvitations.tokenHash, hashInvitationToken(token)),
        isNull(employerInvitations.acceptedAt),
        gt(employerInvitations.expiresAt, now),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Creates the employer's `users` row, marks the invitation accepted, and
 * records the terms-acceptance consent — the three writes PLAN-PHASE2.md
 * §2.2 step 3 describes as one event.
 *
 * Re-validates the invitation and claims it with an UPDATE scoped on
 * `acceptedAt IS NULL` rather than trusting an earlier read, so two
 * concurrent submissions of the same token cannot both create a user — the
 * same "the write is the check" pattern as lib/db/employer.ts's scoped
 * writes.
 *
 * Returns null when the token is invalid, expired, or already claimed
 * (including by a losing race) — the caller cannot and must not distinguish
 * those cases from each other.
 */
export async function acceptInvitation(
  token: string,
  input: {
    name: string;
    passwordHash: string;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<number | null> {
  const db = await getDb();
  const now = new Date();
  const tokenHash = hashInvitationToken(token);

  const [invitation] = await db
    .select({
      id: employerInvitations.id,
      companyId: employerInvitations.companyId,
      email: employerInvitations.email,
    })
    .from(employerInvitations)
    .where(
      and(
        eq(employerInvitations.tokenHash, tokenHash),
        isNull(employerInvitations.acceptedAt),
        gt(employerInvitations.expiresAt, now),
      ),
    )
    .limit(1);
  if (!invitation) return null;

  const [claim] = await db
    .update(employerInvitations)
    .set({ acceptedAt: now })
    .where(and(eq(employerInvitations.id, invitation.id), isNull(employerInvitations.acceptedAt)));
  if (claim.affectedRows === 0) return null;

  const [user] = await db.insert(users).values({
    email: invitation.email,
    passwordHash: input.passwordHash,
    name: input.name,
    role: 'employer',
    companyId: invitation.companyId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const { POLICY_VERSION } = await import('../policy');
  await db.insert(consents).values({
    subjectType: 'employer_user',
    subjectId: user.insertId,
    purpose: 'terms_acceptance',
    granted: true,
    policyVersion: POLICY_VERSION,
    relatedCompanyId: invitation.companyId,
    relatedJobId: null,
    ip: input.ip,
    userAgent: input.userAgent,
    createdAt: now,
  });

  return user.insertId;
}
