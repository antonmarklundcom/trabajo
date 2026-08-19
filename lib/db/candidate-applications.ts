// Candidate-scoped application reads/writes — one-click apply and
// "mis postulaciones" (PLAN-PHASE2.md §4.1 consent #2, §4.2 withdrawal).
//
// Same discipline as lib/db/employer.ts and lib/db/candidate-profile.ts: every
// export takes `candidateId` as its FIRST parameter and every query mentions
// it in the WHERE clause.
//
// The anonymous lead form (lib/leads.ts, POST /api/v1/leads →
// lib/db/admin.ts#createApplication) is UNTOUCHED by this module — a
// logged-in apply is a second, parallel write path onto the same
// `applications` table, not a replacement for the first (PLAN-PHASE2.md §8 Q9).
import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { applications, candidates, consents, jobs } from './schema';
import { getCurrentCandidateCv } from './candidate-cvs';

async function getDb() {
  return (await import('./index')).db;
}

export type ApplyResult =
  | { ok: true; applicationId: number }
  | { ok: false; reason: 'job_not_found' | 'already_applied' };

export type ApplyInput = {
  jobSlug: string;
  message: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * One-click apply: consent #2 (`application_share`), named to the specific
 * employer via `related_company_id` / `related_job_id`, then the application
 * row carrying `candidate_id` / `consent_id` / `cv_id`.
 *
 * Only applies to `published` jobs — the same visibility rule the public site
 * enforces (lib/db/queries.ts), applied here independently because this path
 * does not go through that predicate.
 */
export async function createCandidateApplication(
  candidateId: number,
  input: ApplyInput,
): Promise<ApplyResult> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();

  const [job] = await db
    .select({ id: jobs.id, companyId: jobs.companyId, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.slug, input.jobSlug))
    .limit(1);
  if (!job || job.status !== 'published') return { ok: false, reason: 'job_not_found' };

  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.candidateId, candidateId), eq(applications.jobId, job.id)))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: 'already_applied' };

  const [candidate] = await db
    .select({ name: candidates.name, phone: candidates.phone, email: candidates.email })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);
  if (!candidate) return { ok: false, reason: 'job_not_found' };

  const currentCv = await getCurrentCandidateCv(candidateId);
  const now = new Date();

  // One transaction, because these two rows are one fact. The consent row
  // authorises sharing this candidate's data with this employer, and the
  // application row is that sharing; a crash between them leaves a consent
  // authorising a share that never happened — a record that overstates what the
  // candidate agreed to, which is the wrong direction for an ARCO evidence
  // table (§12.1).
  try {
    const applicationId = await db.transaction(async (tx) => {
      const [consentResult] = await tx.insert(consents).values({
        subjectType: 'candidate',
        subjectId: candidateId,
        purpose: 'application_share',
        granted: true,
        policyVersion: POLICY_VERSION,
        relatedCompanyId: job.companyId,
        relatedJobId: job.id,
        ip: input.ip,
        userAgent: input.userAgent,
        createdAt: now,
      });

      const [appResult] = await tx.insert(applications).values({
        jobId: job.id,
        candidateId,
        consentId: consentResult.insertId,
        cvId: currentCv?.id ?? null,
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
        message: input.message,
        sourcePage: `/postulante/apply/${input.jobSlug}`,
        status: 'new',
        createdAt: now,
      });

      return appResult.insertId;
    });

    return { ok: true, applicationId };
  } catch (err) {
    // The SELECT above is a fast path for the common case, not the guard. Two
    // concurrent submits both pass it; the unique index is what makes the
    // second one impossible rather than merely unlikely, and this is where that
    // refusal becomes the same answer the user would have got a millisecond
    // earlier. The transaction has already rolled the consent row back, so the
    // loser leaves nothing behind.
    if (isDuplicateApplication(err)) return { ok: false, reason: 'already_applied' };
    throw err;
  }
}

/**
 * MySQL's duplicate-key error, narrowed to the constraint this module owns.
 *
 * Checking the constraint name matters: a bare ER_DUP_ENTRY test would also
 * swallow a duplicate from some future index on this table and report it to the
 * candidate as "you already applied", which would be a lie that looks like a
 * feature.
 */
function isDuplicateApplication(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: string; errno?: number; message?: string };
  const isDuplicate = candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
  return isDuplicate && (candidate.message ?? '').includes('candidate_job_application_unique_idx');
}

/** Whether this candidate has already applied to this job (drives the apply button). */
export async function hasCandidateApplied(candidateId: number, jobSlug: string): Promise<boolean> {
  const db = await getDb();
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, jobSlug)).limit(1);
  if (!job) return false;
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.candidateId, candidateId), eq(applications.jobId, job.id)))
    .limit(1);
  return rows.length > 0;
}

export type CandidateApplication = {
  id: number;
  jobTitle: string;
  jobSlug: string;
  companyName: string;
  status: string;
  redactedAt: Date | null;
  createdAt: Date;
};

export async function listCandidateApplications(candidateId: number): Promise<CandidateApplication[]> {
  const db = await getDb();
  const { companies } = await import('./schema');
  return db
    .select({
      id: applications.id,
      jobTitle: jobs.title,
      jobSlug: jobs.slug,
      companyName: companies.name,
      status: applications.status,
      redactedAt: applications.redactedAt,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(applications.candidateId, candidateId))
    .orderBy(desc(applications.createdAt));
}

/**
 * Consent withdrawal for ONE application (PLAN-PHASE2.md §4.2) — a new
 * `granted=false` consents row (consent is append-only, never edited) plus
 * redaction of this application's personal fields. `candidate_id` is
 * deliberately KEPT (unlike the full-account deletion in §4.4): the candidate
 * must still see this application, marked withdrawn, in their own history.
 *
 * Returns false when the application is not this candidate's, or was already
 * redacted — nothing is touched either way.
 */
export async function withdrawApplicationConsent(
  candidateId: number,
  applicationId: number,
): Promise<boolean> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();

  const [app] = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      redactedAt: applications.redactedAt,
    })
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.candidateId, candidateId)))
    .limit(1);
  if (!app || app.redactedAt) return false;

  const [job] = await db.select({ companyId: jobs.companyId }).from(jobs).where(eq(jobs.id, app.jobId)).limit(1);

  const now = new Date();
  await db.insert(consents).values({
    subjectType: 'candidate',
    subjectId: candidateId,
    purpose: 'application_share',
    granted: false,
    policyVersion: POLICY_VERSION,
    relatedCompanyId: job?.companyId ?? null,
    relatedJobId: app.jobId,
    ip: null,
    userAgent: null,
    createdAt: now,
  });

  await db
    .update(applications)
    .set({
      name: null,
      phone: null,
      email: null,
      message: null,
      cvId: null,
      redactedAt: now,
    })
    .where(and(eq(applications.id, applicationId), eq(applications.candidateId, candidateId), isNull(applications.redactedAt)));

  return true;
}
