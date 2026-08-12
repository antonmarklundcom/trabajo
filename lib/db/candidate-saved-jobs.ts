// Candidate-scoped saved-jobs ("favoritos") reads/writes — a bookmark to read
// or compare later, separate from `applications` (PLAN-PHASE3.md §1).
//
// Same discipline as lib/db/candidate-applications.ts and lib/db/employer.ts:
// every export takes `candidateId` as its FIRST parameter and every query
// mentions it in the WHERE clause. There is no admin branch, no cross-candidate
// view, and no count of how many candidates saved a given job — that would be
// popularity/ranking data on candidates, out of scope per AGENTS.md ("no
// search, ranking, scoring, matching or bulk export of candidates").
//
// A saved job's job/company columns are read directly from `jobs`/`companies`,
// NOT through lib/db/queries.ts's visiblePredicate(): a candidate must still
// see a row for a job that was later archived, expired or rejected — labelled
// as no longer available — rather than have it silently vanish from their own
// list (PLAN-PHASE3.md §4 point 2).
import 'server-only';

import { and, count, desc, eq, sql } from 'drizzle-orm';

import { companies, jobs, savedJobs } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

/**
 * Idempotent: saving a job that is already saved is a no-op, not an error, so
 * the toggle button never has to distinguish "first save" from "already saved"
 * before calling this.
 *
 * Only `published` jobs can be saved — the same rule
 * createCandidateApplication() applies independently for the same reason: this
 * path does not go through the public visibility predicate.
 */
export async function saveJob(
  candidateId: number,
  jobSlug: string,
): Promise<{ ok: true } | { ok: false; reason: 'job_not_found' }> {
  const db = await getDb();

  const [job] = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.slug, jobSlug))
    .limit(1);
  if (!job || job.status !== 'published') return { ok: false, reason: 'job_not_found' };

  await db
    .insert(savedJobs)
    .values({ candidateId, jobId: job.id, createdAt: new Date() })
    .onDuplicateKeyUpdate({ set: { candidateId: sql`candidate_id` } });

  return { ok: true };
}

/** Returns false when the job was not saved by this candidate — nothing to unsave. */
export async function unsaveJob(candidateId: number, jobSlug: string): Promise<boolean> {
  const db = await getDb();

  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, jobSlug)).limit(1);
  if (!job) return false;

  const [result] = await db
    .delete(savedJobs)
    .where(and(eq(savedJobs.candidateId, candidateId), eq(savedJobs.jobId, job.id)));
  return result.affectedRows > 0;
}

/** Whether this candidate has saved this job (drives the "Guardar"/"Guardado" toggle). */
export async function isJobSaved(candidateId: number, jobSlug: string): Promise<boolean> {
  const db = await getDb();

  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, jobSlug)).limit(1);
  if (!job) return false;

  const rows = await db
    .select({ id: savedJobs.id })
    .from(savedJobs)
    .where(and(eq(savedJobs.candidateId, candidateId), eq(savedJobs.jobId, job.id)))
    .limit(1);
  return rows.length > 0;
}

export type SavedJob = {
  id: number;
  jobTitle: string;
  jobSlug: string;
  companyName: string;
  /** False once the listing is no longer publicly visible (archived/expired/rejected/draft). */
  isAvailable: boolean;
  createdAt: Date;
};

const PAGE_SIZE = 20;

export async function listSavedJobs(
  candidateId: number,
  page = 1,
): Promise<{ savedJobs: SavedJob[]; total: number }> {
  const db = await getDb();

  // Counted through the same two joins as the page query below, not off
  // `saved_jobs` alone. There are no FK constraints in this schema (see
  // schema.ts), so a bookmark whose job row is gone is a state the database
  // permits; counting it while the joined page query drops it would print
  // "5 empleos guardados" above four rows and hand the last page an empty
  // list. The joins are the definition of a listable saved job, so the count
  // has to use them too.
  const [{ total }] = await db
    .select({ total: count() })
    .from(savedJobs)
    .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(savedJobs.candidateId, candidateId));

  const rows = await db
    .select({
      id: savedJobs.id,
      jobTitle: jobs.title,
      jobSlug: jobs.slug,
      companyName: companies.name,
      status: jobs.status,
      expiresAt: jobs.expiresAt,
      createdAt: savedJobs.createdAt,
    })
    .from(savedJobs)
    .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(savedJobs.candidateId, candidateId))
    .orderBy(desc(savedJobs.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const now = new Date();
  return {
    savedJobs: rows.map((row) => ({
      id: row.id,
      jobTitle: row.jobTitle,
      jobSlug: row.jobSlug,
      companyName: row.companyName,
      isAvailable: row.status === 'published' && (!row.expiresAt || row.expiresAt > now),
      createdAt: row.createdAt,
    })),
    total,
  };
}
