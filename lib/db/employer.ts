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

import { and, asc, count, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import {
  activityLog,
  applications,
  applicationStatusEnum,
  candidateCvs,
  categories,
  cities,
  companies,
  jobImages,
  jobs,
  jobStatusEnum,
  users,
} from './schema';
import { slugify, uniqueSlug } from '../slug';
import { deleteImage } from '../image-storage';

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
 * Fields that were part of what the curation team approved. Changing any of
 * these on a published job returns it to `pending` (PLAN-PHASE2.md §6.1):
 *
 *   - title/description are the content that was reviewed.
 *   - salaryMin/salaryMax/salaryHidden — changing the advertised salary after
 *     approval is the classic bait-and-switch, and it is exactly what a
 *     moderation queue exists to catch.
 *   - categoryId/cityId/contractType/seniority/modality decide which SEO
 *     landings the listing appears on, so a silent change is a silent
 *     re-targeting.
 *
 * `whatsapp` and the company-profile fields are deliberately NOT here: they
 * apply live without knocking a published listing offline (owner decision,
 * 2026-08-09 — see PLAN-PHASE2.md §6.1 for why the original "any edit
 * re-approves" rule was too strict).
 */
const STRICT_REVIEW_FIELDS = [
  'title',
  'description',
  'salaryMin',
  'salaryMax',
  'salaryHidden',
  'categoryId',
  'cityId',
  'contractType',
  'seniority',
  'modality',
] as const satisfies readonly (keyof EmployerJobInput)[];

function isMaterialChange(
  existing: Pick<typeof jobs.$inferSelect, (typeof STRICT_REVIEW_FIELDS)[number]>,
  input: EmployerJobInput,
): boolean {
  return STRICT_REVIEW_FIELDS.some((field) => existing[field] !== input[field]);
}

/**
 * Returns true if a row was actually updated. False means the job does not
 * exist OR belongs to another company — the caller must not distinguish the
 * two, because telling an employer "that job exists but is not yours" leaks
 * that it exists.
 *
 * The material-change rule (PLAN-PHASE2.md §6.1): a `draft`/`pending`/
 * `rejected`/`archived` job stays pending whatever changed, same as before.
 * A `published` job only returns to `pending` when a STRICT_REVIEW_FIELDS
 * value actually changed — a WhatsApp number fix must not take a live listing
 * offline. The read used for the comparison is not a substitute for the
 * ownership check: that still lives in the UPDATE's WHERE clause below, so a
 * stale read only risks computing the wrong status, never an unauthorized
 * write.
 */
export async function updateEmployerJob(
  companyId: number,
  actorUserId: number,
  jobId: number,
  input: EmployerJobInput,
): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  const existing = await getEmployerJob(companyId, jobId);
  if (!existing) return false;

  const needsReapproval = existing.status !== 'published' || isMaterialChange(existing, input);

  const [result] = await db
    .update(jobs)
    .set({
      ...input,
      status: needsReapproval ? 'pending' : 'published',
      publishedAt: needsReapproval ? null : existing.publishedAt,
      rejectionReason: needsReapproval ? null : existing.rejectionReason,
      updatedBy: actorUserId,
      updatedAt: now,
    })
    // Ownership lives here, not in the preceding SELECT.
    .where(and(eq(jobs.id, jobId), ownedByCompany(companyId)));

  const changed = result.affectedRows > 0;
  if (changed) await logEmployerActivity(actorUserId, 'job', jobId, 'employer_update');
  return changed;
}

// ---------------------------------------------------------------------------
// Job images (PLAN-IMAGES.md) — 1–3 public photos per posting, stored through
// lib/image-storage.ts. Every function below still opens with the ownership
// check the rest of this file requires: an image row has no company_id of its
// own, so the scope comes from the job it belongs to, exactly like
// `applications` above.
// ---------------------------------------------------------------------------

export const MAX_JOB_IMAGES = 3;

export type EmployerJobImage = {
  id: number;
  imageKey: string;
  width: number;
  height: number;
  sortOrder: number;
};

const jobImageColumns = {
  id: jobImages.id,
  imageKey: jobImages.imageKey,
  width: jobImages.width,
  height: jobImages.height,
  sortOrder: jobImages.sortOrder,
};

export async function listEmployerJobImages(
  companyId: number,
  jobId: number,
): Promise<EmployerJobImage[]> {
  const db = await getDb();
  return db
    .select(jobImageColumns)
    .from(jobImages)
    .innerJoin(jobs, eq(jobImages.jobId, jobs.id))
    .where(and(eq(jobImages.jobId, jobId), ownedByCompany(companyId)))
    .orderBy(asc(jobImages.sortOrder), asc(jobImages.id));
}

export type NewJobImage = { key: string; width: number; height: number };

export type AddJobImageResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not_found' | 'limit_reached' };

/**
 * Appends one image to the job, or refuses. The MAX_JOB_IMAGES check and the
 * insert are not one atomic statement — two near-simultaneous uploads on the
 * same job could both pass the count check — which is an accepted race on a
 * limit this small, the same tradeoff every other count-then-write path in
 * this codebase makes.
 */
export async function addEmployerJobImage(
  companyId: number,
  actorUserId: number,
  jobId: number,
  image: NewJobImage,
): Promise<AddJobImageResult> {
  const job = await getEmployerJob(companyId, jobId);
  if (!job) return { ok: false, reason: 'not_found' };

  const existing = await listEmployerJobImages(companyId, jobId);
  if (existing.length >= MAX_JOB_IMAGES) return { ok: false, reason: 'limit_reached' };

  const db = await getDb();
  const [result] = await db.insert(jobImages).values({
    jobId,
    imageKey: image.key,
    width: image.width,
    height: image.height,
    sortOrder: existing.length,
    createdAt: new Date(),
  });

  await logEmployerActivity(actorUserId, 'job', jobId, 'employer_add_image');
  return { ok: true, id: result.insertId };
}

/**
 * Deletes one image: the object first, then the row (PLAN-IMAGES.md §5, same
 * asymmetry as CVs). Returns false when the image does not exist, is not on
 * this job, or the job is not this company's — a caller must not distinguish
 * those, same reasoning as updateEmployerJob().
 */
export async function deleteEmployerJobImage(
  companyId: number,
  actorUserId: number,
  jobId: number,
  imageId: number,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: jobImages.id, imageKey: jobImages.imageKey })
    .from(jobImages)
    .innerJoin(jobs, eq(jobImages.jobId, jobs.id))
    .where(and(eq(jobImages.id, imageId), eq(jobImages.jobId, jobId), ownedByCompany(companyId)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;

  // Throws on anything but "already gone". Deliberately outside a try/catch —
  // this must not reach the row delete below with the object still stored.
  await deleteImage(row.imageKey);

  await db.delete(jobImages).where(eq(jobImages.id, imageId));
  await logEmployerActivity(actorUserId, 'job', jobId, 'employer_delete_image');
  return true;
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
 * The CV attached to one of THIS company's applications, or null.
 *
 * PLAN-PHASE2.md §3.3: the employer path keys on the **application**, not on
 * the CV id, because an employer's right to a CV comes from the application —
 * so the URL carries that relationship rather than leaving the handler to
 * reconstruct it from a CV id an employer could have guessed.
 *
 * Three conditions, all in one WHERE so none can be forgotten by a caller:
 *   - the application's job belongs to this company;
 *   - the application is not redacted (the candidate withdrew consent or
 *     deleted their account — §4.2/§4.4 — and consent, not possession of a
 *     link, is what makes the CV visible);
 *   - the CV row is live (its bytes still exist).
 */
export async function getEmployerApplicationCv(companyId: number, applicationId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      applicationId: applications.id,
      cvId: candidateCvs.id,
      storageKey: candidateCvs.storageKey,
      originalFilename: candidateCvs.originalFilename,
      mimeType: candidateCvs.mimeType,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(candidateCvs, eq(applications.cvId, candidateCvs.id))
    .where(
      and(
        eq(applications.id, applicationId),
        ownedByCompany(companyId),
        isNull(applications.redactedAt),
        isNull(candidateCvs.deletedAt),
      ),
    )
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

/**
 * Partial because two different routes write into this row: the profile
 * PATCH sends whatsapp/website/description together, and the logo route
 * (app/api/empresa/logo) sends `logoKey` alone. `logoUrl` is deliberately
 * not a field here — it is legacy data, read-only from PR 19 on
 * (PLAN-IMAGES.md §5), and no employer write path may touch it.
 */
export type EmployerCompanyInput = Partial<{
  whatsapp: string | null;
  website: string | null;
  description: string | null;
  logoKey: string | null;
  notifyOnApplication: boolean;
}>;

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

/**
 * Who to email when an application lands on this company's listing (N2).
 *
 * Returns an empty list — not an error — when the company has turned the
 * notification off, so the toggle is enforced at the read that produces the
 * recipients rather than at each call site that might forget. Only ACTIVE
 * employer users: a deactivated account is one the team has cut off, and
 * cutting off the dashboard while still mailing them is not cutting them off.
 *
 * `name` and `email` only. This list is for addressing an email that carries no
 * applicant data (see lib/emails/employer.ts), and returning more would invite
 * a caller to put it in one.
 */
export async function listEmployerNotificationRecipients(
  companyId: number,
): Promise<{ name: string; email: string }[]> {
  const db = await getDb();

  const [company] = await db
    .select({ notifyOnApplication: companies.notifyOnApplication })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company || !company.notifyOnApplication) return [];

  return db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'employer'), eq(users.isActive, true)));
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
