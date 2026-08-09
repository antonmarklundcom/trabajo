// Candidate-scoped CV rows — the DB half of the CV storage layer.
//
// Same discipline as lib/db/employer.ts (PLAN-PHASE2.md §2.3, AGENTS.md), for
// the same reason: **every exported function takes `candidateId` as its FIRST
// parameter and every query mentions it in the WHERE clause.** A CV is the most
// personal object this application stores, and "does this leak someone else's
// CV?" must be answerable by reading one file and checking that every query
// names the candidate.
//
// There is no admin branch here. Admin access to a CV goes through
// lib/db/candidates-admin.ts, which logs before it returns; employer access
// goes through getEmployerApplicationCv() in lib/db/employer.ts, which is
// scoped by company and keyed on the application. Three callers, three modules,
// no shared "trust me" flag between them.
//
// `db` is imported lazily for the same reason as everywhere else in lib/db:
// lib/db/index.ts opens its pool at module evaluation and this module is
// reachable from the route tree when DATA_SOURCE=seed and DATABASE_URL is unset.
import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { applications, candidateCvs } from './schema';
import { getStorage } from '../storage';

async function getDb() {
  return (await import('./index')).db;
}

export type CandidateCv = {
  id: number;
  candidateId: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isCurrent: boolean;
  uploadedAt: Date;
};

const cvColumns = {
  id: candidateCvs.id,
  candidateId: candidateCvs.candidateId,
  storageKey: candidateCvs.storageKey,
  originalFilename: candidateCvs.originalFilename,
  mimeType: candidateCvs.mimeType,
  sizeBytes: candidateCvs.sizeBytes,
  isCurrent: candidateCvs.isCurrent,
  uploadedAt: candidateCvs.uploadedAt,
};

/**
 * A row whose bytes are still in storage. `deleted_at` is bookkeeping for the
 * purge sweep, not a soft delete — by the time it is set the object is already
 * gone (PLAN-PHASE2.md §3.4), so a row carrying it must never be handed to a
 * download path that would then 404 against storage.
 */
function live() {
  return isNull(candidateCvs.deletedAt);
}

/** One CV, or null when it belongs to someone else or its bytes are gone. */
export async function getCandidateCv(
  candidateId: number,
  cvId: number,
): Promise<CandidateCv | null> {
  const db = await getDb();
  const rows = await db
    .select(cvColumns)
    .from(candidateCvs)
    .where(and(eq(candidateCvs.id, cvId), eq(candidateCvs.candidateId, candidateId), live()))
    .limit(1);
  return rows[0] ?? null;
}

/** The CV a new application would attach, or null if they have not uploaded one. */
export async function getCurrentCandidateCv(candidateId: number): Promise<CandidateCv | null> {
  const db = await getDb();
  const rows = await db
    .select(cvColumns)
    .from(candidateCvs)
    .where(and(eq(candidateCvs.candidateId, candidateId), eq(candidateCvs.isCurrent, true), live()))
    .orderBy(desc(candidateCvs.uploadedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Every live CV of one candidate, newest first. */
export async function listCandidateCvs(candidateId: number): Promise<CandidateCv[]> {
  const db = await getDb();
  return db
    .select(cvColumns)
    .from(candidateCvs)
    .where(and(eq(candidateCvs.candidateId, candidateId), live()))
    .orderBy(desc(candidateCvs.uploadedAt));
}

export type NewCandidateCv = {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Records an upload whose bytes are ALREADY in storage, and demotes the
 * previous current CV.
 *
 * Bytes first, row second — the mirror image of the deletion ordering, and for
 * the same reason. A row pointing at an object that was never written is a
 * broken download for the employer who clicks it; an object with no row is
 * merely 5 MB of garbage the purge sweep can find by prefix.
 *
 * Old rows are kept rather than replaced: applications reference a specific
 * `cv_id`, and replacing a CV must not silently change which document an
 * employer already received (PLAN-PHASE2.md §1.2).
 */
export async function createCandidateCv(
  candidateId: number,
  input: NewCandidateCv,
): Promise<number> {
  const db = await getDb();
  const now = new Date();

  await db
    .update(candidateCvs)
    .set({ isCurrent: false })
    .where(and(eq(candidateCvs.candidateId, candidateId), eq(candidateCvs.isCurrent, true)));

  const [result] = await db.insert(candidateCvs).values({
    candidateId,
    storageKey: input.storageKey,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    isCurrent: true,
    uploadedAt: now,
  });

  return result.insertId;
}

/**
 * Deletes a CV: **the object first, then the row.** Returns false when the CV
 * is not this candidate's, in which case nothing is touched.
 *
 * The ordering is PLAN-PHASE2.md §3.4 and it is not an implementation detail.
 * If storage.delete() throws, this function throws with it and the row survives
 * — an orphaned row pointing at bytes we failed to remove is recoverable, and
 * it is the only remaining record of where those bytes are. Deleting the row
 * first and then failing would leave a CV in a bucket that no query can ever
 * find again, which is precisely the outcome an ARCO cancellation must not
 * produce.
 *
 * Applications that referenced this CV keep their row and lose the pointer:
 * `cv_id` is NULLed in the same call, so an employer's "ver CV" link stops
 * resolving the moment the file stops existing rather than 404ing later.
 */
export async function deleteCandidateCv(candidateId: number, cvId: number): Promise<boolean> {
  const db = await getDb();

  const cv = await getCandidateCv(candidateId, cvId);
  if (!cv) return false;

  // Throws on anything but "the bytes are already gone". Deliberately outside
  // any try/catch: this function must not be able to reach the DB writes below
  // with the object still in the bucket.
  await getStorage().delete(cv.storageKey);

  await db
    .update(applications)
    .set({ cvId: null })
    .where(and(eq(applications.cvId, cvId), eq(applications.candidateId, candidateId)));

  await db
    .delete(candidateCvs)
    .where(and(eq(candidateCvs.id, cvId), eq(candidateCvs.candidateId, candidateId)));

  return true;
}
