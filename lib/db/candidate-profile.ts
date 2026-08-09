// Candidate-scoped profile + work-history reads and writes for
// /postulante/perfil and /api/postulante/*.
//
// Same discipline as lib/db/employer.ts (PLAN-PHASE2.md §2.3, AGENTS.md):
// every exported function takes `candidateId` as its FIRST parameter and every
// query mentions it in the WHERE clause. There is no admin branch here — admin
// reads of candidate data go through lib/db/candidates-admin.ts, which logs.
import 'server-only';

import { and, asc, desc, eq } from 'drizzle-orm';

import { candidateExperiences, candidates, consents } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

// ---------------------------------------------------------------------------
// Registration — consent #1 (PLAN-PHASE2.md §4.1)
// ---------------------------------------------------------------------------

export type RegisterCandidateInput = {
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  cityId: number | null;
  ip: string | null;
  userAgent: string | null;
};

export type RegisterCandidateResult =
  | { ok: true; candidateId: number }
  | { ok: false; reason: 'email_taken' };

/**
 * Creates the candidate row and the `profile_storage` consent row in the same
 * call, because a candidate row with no consent row is an impossible state in
 * production (PLAN-PHASE2.md §4.1 — signup is blocking on this consent).
 */
export async function registerCandidate(
  input: RegisterCandidateInput,
): Promise<RegisterCandidateResult> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();
  const email = input.email.trim().toLowerCase();

  const existing = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.email, email))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: 'email_taken' };

  const now = new Date();
  const [result] = await db.insert(candidates).values({
    email,
    passwordHash: input.passwordHash,
    name: input.name,
    phone: input.phone,
    cityId: input.cityId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(consents).values({
    subjectType: 'candidate',
    subjectId: result.insertId,
    purpose: 'profile_storage',
    granted: true,
    policyVersion: POLICY_VERSION,
    relatedCompanyId: null,
    relatedJobId: null,
    ip: input.ip,
    userAgent: input.userAgent,
    createdAt: now,
  });

  return { ok: true, candidateId: result.insertId };
}

export type CandidateProfileInput = {
  name: string;
  phone: string;
  cityId: number | null;
  headline: string | null;
};

/**
 * Deliberately no `email` here — changing the login email is a bigger
 * operation (it would need re-verification) and is out of scope for this PR;
 * candidates who need it corrected use the ARCO rectification contact in
 * /privacidad §8 until that flow exists.
 */
export async function updateCandidateProfile(
  candidateId: number,
  input: CandidateProfileInput,
): Promise<void> {
  const db = await getDb();
  await db
    .update(candidates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(candidates.id, candidateId));
}

export type CandidateExperience = {
  id: number;
  candidateId: number;
  companyName: string;
  title: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
  description: string | null;
  sortOrder: number;
};

function toDateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export async function listCandidateExperiences(candidateId: number): Promise<CandidateExperience[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, candidateId))
    .orderBy(asc(candidateExperiences.sortOrder), asc(candidateExperiences.id));

  return rows.map((row) => ({
    ...row,
    startMonth: toDateString(row.startMonth),
    endMonth: row.endMonth ? toDateString(row.endMonth) : null,
  }));
}

export type CandidateExperienceInput = {
  companyName: string;
  title: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
  description: string | null;
};

export async function createCandidateExperience(
  candidateId: number,
  input: CandidateExperienceInput,
): Promise<number> {
  const db = await getDb();
  const last = await db
    .select({ sortOrder: candidateExperiences.sortOrder })
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, candidateId))
    .orderBy(desc(candidateExperiences.sortOrder))
    .limit(1);
  const nextOrder = last.length > 0 ? last[0].sortOrder + 1 : 0;

  const [result] = await db.insert(candidateExperiences).values({
    candidateId,
    companyName: input.companyName,
    title: input.title,
    startMonth: new Date(input.startMonth),
    endMonth: input.endMonth ? new Date(input.endMonth) : null,
    isCurrent: input.isCurrent,
    description: input.description,
    sortOrder: nextOrder,
  });
  return result.insertId;
}

/** Returns false when the row is not this candidate's — nothing is touched. */
export async function updateCandidateExperience(
  candidateId: number,
  experienceId: number,
  input: CandidateExperienceInput,
): Promise<boolean> {
  const db = await getDb();
  const [result] = await db
    .update(candidateExperiences)
    .set({
      companyName: input.companyName,
      title: input.title,
      startMonth: new Date(input.startMonth),
      endMonth: input.endMonth ? new Date(input.endMonth) : null,
      isCurrent: input.isCurrent,
      description: input.description,
    })
    .where(and(eq(candidateExperiences.id, experienceId), eq(candidateExperiences.candidateId, candidateId)));
  return result.affectedRows > 0;
}

export async function deleteCandidateExperience(
  candidateId: number,
  experienceId: number,
): Promise<boolean> {
  const db = await getDb();
  const [result] = await db
    .delete(candidateExperiences)
    .where(and(eq(candidateExperiences.id, experienceId), eq(candidateExperiences.candidateId, candidateId)));
  return result.affectedRows > 0;
}
