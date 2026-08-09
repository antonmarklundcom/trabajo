// Admin access to candidate data — the sharpest edge in PLAN-PHASE2.md, and
// the module the privacy policy's "ese acceso queda registrado" sentence is a
// promise about (/privacidad, shipped in PR 6).
//
// ===========================================================================
// THE ONE RULE IN THIS FILE (PLAN-PHASE2.md §2.4)
//
//   Every exported function takes the acting `SessionUser` and a non-empty
//   `reason`, and writes its data_access_logs row INSIDE the function, before
//   returning. There is no code path here that returns candidate data and
//   skips the write.
//
// That is a construction, not a convention: the logging cannot be forgotten by
// a route handler or a page, because the route handler never sees the data
// until the log row exists. The alternative — logging in the UI layer — is one
// refactor away from a silent read.
//
// `role` is checked as exactly `admin`. `editor` does not get candidate access,
// which is a deliberate narrowing versus today's admin/editor parity: the
// curation team needs jobs, not CVs.
// ===========================================================================
//
// PR 7 populates this module with the CV path only, because that is the one
// admin candidate-data read that exists so far. PR 12 adds listCandidates() /
// viewCandidate() and the /admin/postulantes surface on top of the same
// construction.
import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { candidateCvs, dataAccessLogs, type dataAccessActionEnum } from './schema';
import { AuthError, type SessionUser } from '../auth';

async function getDb() {
  return (await import('./index')).db;
}

/** Thrown when a drill-down is attempted without a usable reason. */
export class ReasonRequiredError extends Error {
  constructor() {
    super('A reason is required to access candidate data.');
    this.name = 'ReasonRequiredError';
  }
}

export const MAX_REASON_LENGTH = 255;
const MIN_REASON_LENGTH = 3;

/**
 * Rejects empty and whitespace-only reasons rather than storing them. A blank
 * reason column is worse than no column: it looks like an answer.
 */
function requireReason(reason: string): string {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < MIN_REASON_LENGTH) throw new ReasonRequiredError();
  return trimmed.slice(0, MAX_REASON_LENGTH);
}

function requireAdmin(actor: SessionUser): void {
  if (actor.role !== 'admin') {
    throw new AuthError(403, `Role "${actor.role}" may not access candidate data.`);
  }
}

export type AccessContext = {
  /** From x-forwarded-for at the route boundary. Null when unknown. */
  ip: string | null;
};

async function logAccess(
  actor: SessionUser,
  action: (typeof dataAccessActionEnum)[number],
  subjectType: string,
  subjectId: number,
  reason: string,
  context: AccessContext,
): Promise<void> {
  const db = await getDb();
  await db.insert(dataAccessLogs).values({
    actorUserId: actor.id,
    actorRole: actor.role,
    action,
    subjectType,
    subjectId,
    reason,
    ip: context.ip,
    createdAt: new Date(),
  });
}

export type AdminCv = {
  id: number;
  candidateId: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
};

/**
 * A CV, for an admin, with the access recorded. Returns null when the CV does
 * not exist or its bytes are already gone.
 *
 * The log row names the **candidate**, not the CV: the question this table has
 * to answer cheaply is "who has looked at my data", asked by a candidate, and
 * `(subject_type, subject_id, created_at)` is indexed for exactly that. The
 * action `view_cv` records which kind of access it was.
 *
 * Nothing is logged when there is no row, because nothing was disclosed — an
 * id that resolves to nothing tells the reader neither who the candidate is nor
 * what their CV contains.
 */
export async function viewCandidateCvAsAdmin(
  actor: SessionUser,
  cvId: number,
  reason: string,
  context: AccessContext,
): Promise<AdminCv | null> {
  requireAdmin(actor);
  const validReason = requireReason(reason);

  const db = await getDb();
  const rows = await db
    .select({
      id: candidateCvs.id,
      candidateId: candidateCvs.candidateId,
      storageKey: candidateCvs.storageKey,
      originalFilename: candidateCvs.originalFilename,
      mimeType: candidateCvs.mimeType,
    })
    .from(candidateCvs)
    .where(and(eq(candidateCvs.id, cvId), isNull(candidateCvs.deletedAt)))
    .limit(1);

  const cv = rows[0];
  if (!cv) return null;

  // Before the return, always. If this insert throws, the caller gets the
  // error and not the CV — which is the correct failure direction for a
  // logging guarantee we made in writing.
  await logAccess(actor, 'view_cv', 'candidate', cv.candidateId, validReason, context);

  return cv;
}
