// Admin-side reads and mutations for /admin/* and /api/admin/*.
//
// Deliberately separate from lib/db/queries.ts: that file is the public read
// path and its visiblePredicate() must never be near admin code that needs to
// see draft/pending/rejected/archived jobs and inactive users too
// (ARCHITECTURE.md §3/§4, AGENTS.md — public reads go through the single
// visibility predicate).
//
// `db` is imported lazily (like lib/auth.ts's getDb()): lib/db/index.ts opens
// its connection pool at module-evaluation time, and this module is reachable
// from /admin's route tree even when DATA_SOURCE=seed and DATABASE_URL is
// unset — a static import would break `next build`'s page-data collection
// for the public site.
import 'server-only';

import { and, asc, count, desc, eq, like, ne, or } from 'drizzle-orm';
import {
  activityLog,
  applications,
  applicationStatusEnum,
  categories,
  cities,
  companies,
  jobImages,
  jobs,
  jobStatusEnum,
  savedJobs,
  users,
} from './schema';
import type { Role } from '../auth';
import { normalizePhone } from '../leads';
import { slugify, uniqueSlug } from '../slug';
import { deleteImage } from '../image-storage';

async function getDb() {
  return (await import('./index')).db;
}

// ---------------------------------------------------------------------------
// Lookups — for admin <select> options. Unlike lib/db/queries.ts's
// getCategories()/getCities(), these expose the numeric id the jobs table's
// FKs need. Re-exported from lib/db/taxonomy.ts, which also serves the
// employer job form — see that file for why it isn't defined here.
// ---------------------------------------------------------------------------

export { listCategoryOptions, listCityOptions } from './taxonomy';

export async function listCompanyOptions() {
  const db = await getDb();
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(asc(companies.name));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const db = await getDb();
  const [[pending], [published], [totalCompanies], recent] = await Promise.all([
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'pending')),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'published')),
    db.select({ n: count() }).from(companies),
    db
      .select({
        id: activityLog.id,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        action: activityLog.action,
        createdAt: activityLog.createdAt,
        actorName: users.name,
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.actorUserId, users.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(10),
  ]);

  return {
    pendingCount: pending.n,
    publishedCount: published.n,
    companyCount: totalCompanies.n,
    recentActivity: recent,
  };
}

async function logActivity(
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

// ---------------------------------------------------------------------------
// Jobs — admin list/detail (every status, unlike the public predicate)
// ---------------------------------------------------------------------------

export type AdminJobFilters = {
  status?: (typeof jobStatusEnum)[number];
  q?: string;
  page?: number;
};

const ADMIN_PAGE_SIZE = 20;

export async function getAdminJobs(filters: AdminJobFilters) {
  const db = await getDb();
  const page = filters.page ?? 1;
  const conditions = [];
  if (filters.status) conditions.push(eq(jobs.status, filters.status));
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(like(jobs.title, term), like(companies.name, term)));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const selection = {
    id: jobs.id,
    slug: jobs.slug,
    title: jobs.title,
    company: companies.name,
    category: categories.name,
    city: cities.name,
    status: jobs.status,
    featuredUntil: jobs.featuredUntil,
    publishedAt: jobs.publishedAt,
    createdAt: jobs.createdAt,
    applicantCount: count(applications.id),
  };

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(selection)
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .innerJoin(categories, eq(jobs.categoryId, categories.id))
      .innerJoin(cities, eq(jobs.cityId, cities.id))
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(where)
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .innerJoin(categories, eq(jobs.categoryId, categories.id))
      .innerJoin(cities, eq(jobs.cityId, cities.id))
      .where(where),
  ]);

  return { jobs: rows, total, pageSize: ADMIN_PAGE_SIZE };
}

export async function getAdminJob(id: number) {
  const db = await getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function jobSlugExists(slug: string, excludeId?: number) {
  const db = await getDb();
  const conditions = [eq(jobs.slug, slug)];
  if (excludeId != null) conditions.push(ne(jobs.id, excludeId));
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

export type JobInput = {
  slug: string;
  title: string;
  companyId: number;
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
  status: (typeof jobStatusEnum)[number];
  featuredUntil: Date | null;
  rejectionReason: string | null;
};

export async function createJob(input: JobInput, actorUserId: number) {
  const db = await getDb();
  const now = new Date();
  const publishedAt = input.status === 'published' ? now : null;
  const [result] = await db.insert(jobs).values({
    ...input,
    publishedAt,
    createdBy: actorUserId,
    updatedBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  const insertId = result.insertId;
  await logActivity(actorUserId, 'job', insertId, 'create');
  return insertId;
}

export async function updateJob(id: number, input: JobInput, actorUserId: number) {
  const db = await getDb();
  const existing = await getAdminJob(id);
  const now = new Date();
  const wasPublished = existing?.status === 'published';
  const willPublish = input.status === 'published';
  await db
    .update(jobs)
    .set({
      ...input,
      // A job publishing for the first time gets its publishedAt stamped now;
      // one already published (or never published) keeps its existing value.
      publishedAt: !wasPublished && willPublish ? now : (existing?.publishedAt ?? null),
      updatedBy: actorUserId,
      updatedAt: now,
    })
    .where(eq(jobs.id, id));

  // The activity_log must record what actually happened, not just "update" —
  // the curation team's audit trail is the whole reason this table exists
  // (ARCHITECTURE.md §4). A single save can carry two independent facts: a
  // status transition, and a feature grant — log each separately.
  if (existing) {
    if (!wasPublished && willPublish) {
      await logActivity(actorUserId, 'job', id, existing.status === 'pending' ? 'approve' : 'publish');
    } else if (input.status === 'rejected' && existing.status !== 'rejected') {
      await logActivity(actorUserId, 'job', id, 'reject', { rejectionReason: input.rejectionReason });
    } else if (input.status === 'archived' && existing.status !== 'archived') {
      await logActivity(actorUserId, 'job', id, 'archive');
    } else {
      await logActivity(actorUserId, 'job', id, 'update');
    }

    const existingFeaturedMs = existing.featuredUntil?.getTime() ?? null;
    const nextFeaturedMs = input.featuredUntil?.getTime() ?? null;
    if (nextFeaturedMs != null && nextFeaturedMs !== existingFeaturedMs) {
      await logActivity(actorUserId, 'job', id, 'feature', { featuredUntil: input.featuredUntil!.toISOString() });
    }
  }
}

export async function deleteJob(id: number, actorUserId: number) {
  const db = await getDb();
  // No FK constraint ties saved_jobs or job_images to jobs (schema.ts
  // convention — every cross-table cleanup is done here in code, never by the
  // schema), so a hard delete must clean up both itself or leave a dangling
  // reference behind. Images are objects in storage as well as rows: the
  // bytes are removed before their rows, same ordering as every other image
  // delete in this app (PLAN-IMAGES.md §5).
  const orphanedImages = await db
    .select({ imageKey: jobImages.imageKey })
    .from(jobImages)
    .where(eq(jobImages.jobId, id));
  for (const { imageKey } of orphanedImages) {
    await deleteImage(imageKey);
  }
  await db.delete(jobImages).where(eq(jobImages.jobId, id));
  await db.delete(savedJobs).where(eq(savedJobs.jobId, id));
  await db.delete(jobs).where(eq(jobs.id, id));
  await logActivity(actorUserId, 'job', id, 'delete');
}

// ---------------------------------------------------------------------------
// Job images — admin can edit any job's photos, same 1–3 rule as /empresa
// (PLAN-IMAGES.md §5). No company scoping here: admin oversight of jobs has
// none anywhere else in this file either, and job_images has no company_id of
// its own to scope by.
// ---------------------------------------------------------------------------

export const MAX_JOB_IMAGES = 3;

export type AdminJobImage = {
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

export async function listAdminJobImages(jobId: number): Promise<AdminJobImage[]> {
  const db = await getDb();
  return db
    .select(jobImageColumns)
    .from(jobImages)
    .where(eq(jobImages.jobId, jobId))
    .orderBy(asc(jobImages.sortOrder), asc(jobImages.id));
}

export type NewJobImage = { key: string; width: number; height: number };

export type AddJobImageResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not_found' | 'limit_reached' };

export async function addAdminJobImage(
  jobId: number,
  actorUserId: number,
  image: NewJobImage,
): Promise<AddJobImageResult> {
  const job = await getAdminJob(jobId);
  if (!job) return { ok: false, reason: 'not_found' };

  const existing = await listAdminJobImages(jobId);
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

  await logActivity(actorUserId, 'job', jobId, 'add_image');
  return { ok: true, id: result.insertId };
}

/** Object first, then the row — see deleteJob() above and PLAN-IMAGES.md §5. */
export async function deleteAdminJobImage(
  jobId: number,
  actorUserId: number,
  imageId: number,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: jobImages.id, imageKey: jobImages.imageKey })
    .from(jobImages)
    .where(and(eq(jobImages.id, imageId), eq(jobImages.jobId, jobId)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;

  await deleteImage(row.imageKey);

  await db.delete(jobImages).where(eq(jobImages.id, imageId));
  await logActivity(actorUserId, 'job', jobId, 'delete_image');
  return true;
}

// ---------------------------------------------------------------------------
// Public job submissions — from /publicar. Unauthenticated by design: every
// row lands as `status = 'pending'`, which the visibility predicate in
// lib/db/queries.ts already excludes from every public read. No caller-
// supplied field can make this create anything visible.
// ---------------------------------------------------------------------------

export type PublicJobSubmissionInput = {
  companyName: string;
  contactWhatsapp: string;
  jobTitle: string;
  categorySlug: string;
  citySlug: string;
  description: string;
};

async function findOrCreateCompanyByName(name: string): Promise<number> {
  const db = await getDb();
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.name, trimmed))
    .limit(1);
  if (existing) return existing.id;

  const now = new Date();
  const slug = await uniqueSlug(slugify(trimmed), (candidate) => companySlugExists(candidate));
  const [result] = await db
    .insert(companies)
    .values({ name: trimmed, slug, createdAt: now, updatedAt: now });
  return result.insertId;
}

/**
 * Creates a `pending` job from an employer's /publicar submission. Returns
 * `null` (instead of throwing) when the category or city slug the client sent
 * doesn't exist server-side — the caller treats that as a soft failure so a
 * bad submission never blocks the WhatsApp/webhook fan-out that already ran.
 */
export async function createPublicJobSubmission(
  input: PublicJobSubmissionInput,
): Promise<number | null> {
  const db = await getDb();

  const [[category], [city]] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1),
    db.select({ id: cities.id }).from(cities).where(eq(cities.slug, input.citySlug)).limit(1),
  ]);
  if (!category || !city) return null;

  const companyId = await findOrCreateCompanyByName(input.companyName);
  const slug = await uniqueSlug(slugify(input.jobTitle), (candidate) => jobSlugExists(candidate));
  const now = new Date();

  const [result] = await db.insert(jobs).values({
    slug,
    title: input.jobTitle,
    companyId,
    categoryId: category.id,
    cityId: city.id,
    // Fields the /publicar form doesn't collect — the curation team fills
    // these in from the admin edit screen before approving.
    contractType: 'tiempo_completo',
    seniority: 'sin_experiencia',
    modality: 'presencial',
    salaryHidden: true,
    description: input.description,
    whatsapp: normalizePhone(input.contactWhatsapp),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  return result.insertId;
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function getAdminCompanies(q?: string) {
  const db = await getDb();
  const where = q ? like(companies.name, `%${q}%`) : undefined;
  return db.select().from(companies).where(where).orderBy(asc(companies.name));
}

export async function getAdminCompany(id: number) {
  const db = await getDb();
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function companySlugExists(slug: string, excludeId?: number) {
  const db = await getDb();
  const conditions = [eq(companies.slug, slug)];
  if (excludeId != null) conditions.push(ne(companies.id, excludeId));
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

export type CompanyInput = {
  name: string;
  slug: string;
  logoUrl: string | null;
  whatsapp: string | null;
  website: string | null;
  description: string | null;
};

export async function createCompany(input: CompanyInput, actorUserId: number) {
  const db = await getDb();
  const now = new Date();
  const [result] = await db.insert(companies).values({ ...input, createdAt: now, updatedAt: now });
  await logActivity(actorUserId, 'company', result.insertId, 'create');
  return result.insertId;
}

export async function updateCompany(id: number, input: CompanyInput, actorUserId: number) {
  const db = await getDb();
  await db
    .update(companies)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(companies.id, id));
  await logActivity(actorUserId, 'company', id, 'update');
}

// ---------------------------------------------------------------------------
// Users — admin role only (enforced by the route handler, not here)
// ---------------------------------------------------------------------------

export async function getAdminUsers() {
  const db = await getDb();
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      companyId: users.companyId,
      companyName: companies.name,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .orderBy(asc(users.name));
}

export async function getAdminUser(id: number) {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function emailExists(email: string, excludeId?: number) {
  const db = await getDb();
  const conditions = [eq(users.email, email)];
  if (excludeId != null) conditions.push(ne(users.id, excludeId));
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

export async function createUser(
  input: {
    email: string;
    name: string;
    role: Role;
    companyId: number | null;
    passwordHash: string;
  },
  actorUserId: number,
) {
  const db = await getDb();
  const now = new Date();
  const [result] = await db.insert(users).values({
    ...input,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await logActivity(actorUserId, 'user', result.insertId, 'create');
  return result.insertId;
}

export async function updateUser(
  id: number,
  input: { name: string; role: Role; companyId: number | null; isActive: boolean },
  actorUserId: number,
) {
  const db = await getDb();
  await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, id));
  await logActivity(actorUserId, 'user', id, 'update');
}

// ---------------------------------------------------------------------------
// Applications — inserted from POST /api/v1/leads (public, unauthenticated),
// reviewed from /admin/postulaciones.
// ---------------------------------------------------------------------------

export type ApplicationInput = {
  jobSlug: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  sourcePage: string | null;
};

/**
 * Returns `null` (never throws) when the job slug doesn't resolve — the
 * caller in app/api/v1/leads/route.ts must never let a DB failure fail the
 * seeker's submission (ARCHITECTURE.md §7).
 */
export async function createApplication(input: ApplicationInput): Promise<number | null> {
  const db = await getDb();
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, input.jobSlug)).limit(1);
  if (!job) return null;

  const [result] = await db.insert(applications).values({
    jobId: job.id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    message: input.message,
    sourcePage: input.sourcePage,
    status: 'new',
    createdAt: new Date(),
  });
  return result.insertId;
}

export type AdminApplicationFilters = {
  jobId?: number;
  status?: (typeof applicationStatusEnum)[number];
  page?: number;
};

const APPLICATION_PAGE_SIZE = 20;

export async function getAdminApplications(filters: AdminApplicationFilters) {
  const db = await getDb();
  const page = filters.page ?? 1;
  const conditions = [];
  if (filters.jobId) conditions.push(eq(applications.jobId, filters.jobId));
  if (filters.status) conditions.push(eq(applications.status, filters.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const selection = {
    id: applications.id,
    jobId: applications.jobId,
    jobTitle: jobs.title,
    jobSlug: jobs.slug,
    name: applications.name,
    phone: applications.phone,
    email: applications.email,
    message: applications.message,
    status: applications.status,
    // Set means every personal column above is already NULL: the candidate
    // withdrew consent (§4.2), deleted their account (§4.4) or the row aged out
    // (§4.3). Selected so the admin table can say so, rather than rendering
    // three empty cells that look like a bug.
    redactedAt: applications.redactedAt,
    createdAt: applications.createdAt,
  };

  const base = () =>
    db.select(selection).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id));

  const [rows, [{ total }]] = await Promise.all([
    base()
      .where(where)
      .orderBy(desc(applications.createdAt))
      .limit(APPLICATION_PAGE_SIZE)
      .offset((page - 1) * APPLICATION_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where),
  ]);

  return { applications: rows, total, pageSize: APPLICATION_PAGE_SIZE };
}

/** Jobs that have at least one application — populates the postulaciones job filter. */
export async function listJobOptionsWithApplications() {
  const db = await getDb();
  return db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .innerJoin(applications, eq(applications.jobId, jobs.id))
    .groupBy(jobs.id)
    .orderBy(desc(jobs.createdAt));
}

export async function updateApplicationStatus(
  id: number,
  status: (typeof applicationStatusEnum)[number],
) {
  const db = await getDb();
  await db.update(applications).set({ status }).where(eq(applications.id, id));
}
