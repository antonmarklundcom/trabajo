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
import { activityLog, categories, cities, companies, jobs, jobStatusEnum, users } from './schema';
import type { Role } from '../auth';

async function getDb() {
  return (await import('./index')).db;
}

// ---------------------------------------------------------------------------
// Lookups — for admin <select> options. Unlike lib/db/queries.ts's
// getCategories()/getCities(), these expose the numeric id the jobs table's
// FKs need.
// ---------------------------------------------------------------------------

export async function listCategoryOptions() {
  const db = await getDb();
  return db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder));
}

export async function listCityOptions() {
  const db = await getDb();
  return db
    .select({ id: cities.id, slug: cities.slug, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.sortOrder));
}

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
  };

  const base = () =>
    db
      .select(selection)
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .innerJoin(categories, eq(jobs.categoryId, categories.id))
      .innerJoin(cities, eq(jobs.cityId, cities.id));

  const [rows, [{ total }]] = await Promise.all([
    base()
      .where(where)
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
  await logActivity(actorUserId, 'job', id, 'update');
}

export async function deleteJob(id: number, actorUserId: number) {
  const db = await getDb();
  await db.delete(jobs).where(eq(jobs.id, id));
  await logActivity(actorUserId, 'job', id, 'delete');
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
