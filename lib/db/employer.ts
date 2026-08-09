// Employer-scoped reads and writes for /empresa/* and /api/empresa/*.
//
// ===========================================================================
// THE ONE RULE IN THIS FILE (PLAN-PHASE2.md §2.3, AGENTS.md)
//
//   Every exported function takes `companyId: number` as its FIRST parameter,
//   and every query it runs mentions that companyId in its WHERE clause.
//
// Nothing here reads the session — the caller does that via
// requireCompanyScope() / requireApiCompanyScope(), which fail closed on an
// employer with no company. And nothing here has an admin branch: admin
// oversight is lib/db/admin.ts, a separate module with separate queries.
//
// The point of both constraints is reviewability. "Does this leak another
// company's data?" becomes a property you can check by reading one file and
// confirming every query mentions companyId — a mechanical check — rather than
// a judgement call spread across a dozen route handlers. scripts/verify-
// scoping.ts asserts it at runtime as well.
//
// Corollary for writes: ownership is enforced IN the UPDATE's WHERE clause,
// never by a preceding SELECT. A check-then-write pair is a race; a scoped
// write is not, and it also cannot be reached by a handler that forgot the
// check.
// ===========================================================================
//
// `db` is imported lazily, exactly as in lib/db/admin.ts: lib/db/index.ts opens
// its pool at module evaluation, and this module is reachable from the route
// tree even when DATA_SOURCE=seed and DATABASE_URL is unset.
import 'server-only';

import { and, asc, count, desc, eq, inArray, like, sql } from 'drizzle-orm';
import {
  activityLog,
  applications,
  applicationStatusEnum,
  categories,
  cities,
  companies,
  jobs,
  jobStatusEnum,
} from './schema';
import { slugify, uniqueSlug } from '../slug';

async function getDb() {
  return (await import('./index')).db;
}

export const EMPLOYER_PAGE_SIZE = 20;

/**
 * The scoping predicate, defined once and reused by every job query below —
 * the same discipline as visiblePredicate() on the public side. A new query
 * that forgets it is visible in review as a query that did not call it.
 */
function ownedByCompany(companyId: number) {
  return eq(jobs.companyId, companyId);
}

/**
 * Job ids belonging to this company, as a subquery. Used to scope writes and
 * reads on `applications`, which has no company_id of its own: an employer's
 * right to an application comes from owning the job it was submitted against
 * (PLAN-PHASE2.md §0 — "candidates are linked to companies through their
 * applications"). Deriving it rather than denormalising a company_id onto
 * `applications` keeps one source of truth for that relationship.
 */
function ownedJobIds(companyId: number) {
  return sql`(select ${jobs.id} from ${jobs} where ${jobs.companyId} = ${companyId})`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getEmployerDashboardStats(companyId: number) {
  const db = await getDb();

  const [[published], [pending], [totalApplications], [newApplications]] = await Promise.all([
    db
      .select({ n: count() })
      .from(jobs)
      .where(and(ownedByCompany(companyId), eq(jobs.status, 'published'))),
    db
      .select({ n: count() })
      .from(jobs)
      .where(and(ownedByCompany(companyId), eq(jobs.status, 'pending'))),
    db
      .select({ n: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(ownedByCompany(companyId)),
    db
      .select({ n: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(ownedByCompany(companyId), eq(applications.status, 'new'))),
  ]);

  return {
    publishedCount: published.n,
    pendingCount: pending.n,
    applicationCount: totalApplications.n,
    newApplicationCount: newApplications.n,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type EmployerJobFilters = {
  status?: (typeof jobStatusEnum)[number];
  q?: string;
  page?: number;
};

export async function listEmployerJobs(companyId: number, filters: EmployerJobFilters = {}) {
  const db = await getDb();
  const page = filters.page ?? 1;

  const conditions = [ownedByCompany(companyId)];
  if (filters.status) conditions.push(eq(jobs.status, filters.status));
  if (filters.q) conditions.push(like(jobs.title, `%${filters.q}%`));
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: jobs.id,
        slug: jobs.slug,
        title: jobs.title,
        category: categories.name,
        city: cities.name,
        status: jobs.status,
        featuredUntil: jobs.featuredUntil,
        publishedAt: jobs.publishedAt,
        expiresAt: jobs.expiresAt,
        createdAt: jobs.createdAt,
        rejectionReason: jobs.rejectionReason,
        applicantCount: count(applications.id),
      })
      .from(jobs)
      .innerJoin(categories, eq(jobs.categoryId, categories.id))
      .innerJoin(cities, eq(jobs.cityId, cities.id))
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(where)
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt))
      .limit(EMPLOYER_PAGE_SIZE)
      .offset((page - 1) * EMPLOYER_PAGE_SIZE),
    db.select({ total: count() }).from(jobs).where(where),
  ]);

  return { jobs: rows, total, pageSize: EMPLOYER_PAGE_SIZE };
}

/** One job, or null if it belongs to someone else. Same thing, deliberately. */
export async function getEmployerJob(companyId: number, jobId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), ownedByCompany(companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/** For the applications filter dropdown. */
export async function listEmployerJobOptions(companyId: number) {
  const db = await getDb();
  return db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(ownedByCompany(companyId))
    .orderBy(asc(jobs.title));
}

/**
 * What an employer is allowed to set on a job. Note what is NOT here:
 *
 *   - `slug` — slugs are live SEO URLs and renaming one needs a 301
 *     (AGENTS.md). An employer must not be able to create that obligation, so
 *     the slug is generated once, server-side, and never editable.
 *   - `status` — every employer write lands as `pending`. Self-publishing
 *     would bypass the approval workflow the whole moderation model rests on.
 *   - `featuredUntil` — that is fulfilment of a manual sale, not self-service.
 *   - `companyId` — comes from the session's scope, never from the request.
 */
export type EmployerJobInput = {
  title: string;
  categoryId: number;
  cityId: number;
  contractType: (typeof jobs.$inferInsert)['contractType'];
  seniority: (typeof jobs.$inferInsert)['seniority'];
  modality: (typeof jobs.$inferInsert)['modality'];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryHidden: boolean;
  description: string;
  whatsapp: string | null;
};

async function jobSlugExists(slug: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, slug)).limit(1);
  return rows.length > 0;
}

export async function createEmployerJob(
  companyId: number,
  actorUserId: number,
  input: EmployerJobInput,
): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const slug = await uniqueSlug(slugify(input.title), (candidate) => jobSlugExists(candidate));

  const [result] = await db.insert(jobs).values({
    ...input,
    slug,
    companyId,
    // Not caller-supplied. An employer submission is a request to publish, not
    // a publication; the pending status is what the public visibility
    // predicate already excludes.
    status: 'pending',
    featuredUntil: null,
    publishedAt: null,
    rejectionReason: null,
    createdBy: actorUserId,
    updatedBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  await logEmployerActivity(actorUserId, 'job', result.insertId, 'employer_create');
  return result.insertId;
}

/**
 * Returns true if a row was actually updated. False means the job does not
 * exist OR belongs to another company — the caller must not distinguish the
 * two, because telling an employer "that job exists but is not yours" leaks
 * that it exists.
 *
 * A published job that is edited returns to `pending`: the approved text is
 * what was approved, and letting an employer swap the body of a live listing
 * without re-review is the obvious hole in any approval workflow.
 */
export async function updateEmployerJob(
  companyId: number,
  actorUserId: number,
  jobId: number,
  input: EmployerJobInput,
): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  const [result] = await db
    .update(jobs)
    .set({
      ...input,
      status: 'pending',
      publishedAt: null,
      rejectionReason: null,
      updatedBy: actorUserId,
      updatedAt: now,
    })
    // Ownership lives here, not in a preceding SELECT.
    .where(and(eq(jobs.id, jobId), ownedByCompany(companyId)));

  const changed = result.affectedRows > 0;
  if (changed) await logEmployerActivity(actorUserId, 'job', jobId, 'employer_update');
  return changed;
}

// ---------------------------------------------------------------------------
// Applications
//
// This is the data an employer logs in for, and the data the whole consent
// model exists to protect: it is shown ONLY for jobs this company owns, and
// only while it has not been redacted at the candidate's request.
// ---------------------------------------------------------------------------

export type EmployerApplicationFilters = {
  jobId?: number;
  status?: (typeof applicationStatusEnum)[number];
  page?: number;
};

export async function listEmployerApplications(
  companyId: number,
  filters: EmployerApplicationFilters = {},
) {
  const db = await getDb();
  const page = filters.page ?? 1;

  const conditions = [ownedByCompany(companyId)];
  if (filters.jobId) conditions.push(eq(applications.jobId, filters.jobId));
  if (filters.status) conditions.push(eq(applications.status, filters.status));
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        jobTitle: jobs.title,
        jobSlug: jobs.slug,
        candidateId: applications.candidateId,
        cvId: applications.cvId,
        name: applications.name,
        phone: applications.phone,
        email: applications.email,
        message: applications.message,
        status: applications.status,
        // Surfaced rather than filtered out: a redacted row still happened, and
        // hiding it would make an employer's own history silently shrink. The
        // UI renders a tombstone for these (PLAN-PHASE2.md §4.4) — every
        // personal column above is NULL by the time this is set.
        redactedAt: applications.redactedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(applications.createdAt))
      .limit(EMPLOYER_PAGE_SIZE)
      .offset((page - 1) * EMPLOYER_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where),
  ]);

  return { applications: rows, total, pageSize: EMPLOYER_PAGE_SIZE };
}

/** One application, or null if it was submitted to another company's job. */
export async function getEmployerApplication(companyId: number, applicationId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      jobTitle: jobs.title,
      candidateId: applications.candidateId,
      cvId: applications.cvId,
      name: applications.name,
      phone: applications.phone,
      email: applications.email,
      message: applications.message,
      status: applications.status,
      redactedAt: applications.redactedAt,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(eq(applications.id, applicationId), ownedByCompany(companyId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Moves an application through new → reviewed → contacted → hired/discarded.
 * Returns false when the row is not this company's.
 *
 * `applications` carries no company_id, so the scope comes from a subquery over
 * owned jobs. Written as one statement rather than SELECT-then-UPDATE for the
 * same reason as updateEmployerJob().
 *
 * statusChangedAt/By are what make the funnel in PLAN-PHASE2.md §5.1
 * measurable at all — `status` alone has no time dimension.
 */
export async function setEmployerApplicationStatus(
  companyId: number,
  actorUserId: number,
  applicationId: number,
  status: (typeof applicationStatusEnum)[number],
): Promise<boolean> {
  const db = await getDb();

  const [result] = await db
    .update(applications)
    .set({ status, statusChangedAt: new Date(), statusChangedBy: actorUserId })
    .where(
      and(
        eq(applications.id, applicationId),
        inArray(applications.jobId, ownedJobIds(companyId)),
      ),
    );

  const changed = result.affectedRows > 0;
  if (changed) {
    await logEmployerActivity(actorUserId, 'application', applicationId, 'status_change', {
      status,
    });
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Company profile — the one place an employer edits something that is not a
// job. Name and slug are excluded: the company slug is a public URL, and the
// name is what the platform vouched for when it issued the invitation.
// ---------------------------------------------------------------------------

export type EmployerCompanyInput = {
  whatsapp: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
};

export async function getEmployerCompany(companyId: number) {
  const db = await getDb();
  const rows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return rows[0] ?? null;
}

export async function updateEmployerCompany(
  companyId: number,
  actorUserId: number,
  input: EmployerCompanyInput,
): Promise<boolean> {
  const db = await getDb();
  const [result] = await db
    .update(companies)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  const changed = result.affectedRows > 0;
  if (changed) await logEmployerActivity(actorUserId, 'company', companyId, 'employer_update');
  return changed;
}

// ---------------------------------------------------------------------------
// Activity log
//
// Employer actions are logged into the same activity_log the curation team
// already reads, with `employer_`-prefixed actions so the two are
// distinguishable in the admin feed. Anything an employer does to a listing is
// something the team may later have to explain to them.
// ---------------------------------------------------------------------------

async function logEmployerActivity(
  actorUserId: number,
  entityType: string,
  entityId: number,
  action: string,
  meta?: Record<string, unknown>,
) {
  const db = await getDb();
  await db.insert(activityLog).values({
    actorUserId,
    entityType,
    entityId,
    action,
    meta: meta ?? null,
    createdAt: new Date(),
  });
}

// Re-exported so a caller filtering by status uses the schema's list rather
// than retyping the strings.
export { applicationStatusEnum, jobStatusEnum };
