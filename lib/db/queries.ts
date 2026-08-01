import { and, asc, desc, eq, gt, isNull, like, or, sql, count } from 'drizzle-orm';
import { db } from './index';
import { categories, cities, companies, jobs } from './schema';
import type { Job, Category, City, JobFilters } from '../types';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// The single visibility predicate. Every public query must use this — a
// query that forgets it leaks draft/pending/rejected/archived or expired
// jobs (AGENTS.md, ARCHITECTURE.md §4, MIGRATION.md "known trap").
// ---------------------------------------------------------------------------

export function visiblePredicate() {
  return and(
    eq(jobs.status, 'published'),
    or(isNull(jobs.expiresAt), gt(jobs.expiresAt, sql`NOW()`)),
  );
}

function isFeaturedSql() {
  return sql<number>`CASE WHEN ${jobs.featuredUntil} IS NOT NULL AND ${jobs.featuredUntil} > NOW() THEN 0 ELSE 1 END`;
}

// ---------------------------------------------------------------------------
// Row -> Job mapping. Joined columns (company name/logo, category/city slug)
// are selected explicitly so this stays a flat, cheap query.
// ---------------------------------------------------------------------------

const jobSelection = {
  slug: jobs.slug,
  title: jobs.title,
  company: companies.name,
  companyLogo: companies.logoUrl,
  categorySlug: categories.slug,
  citySlug: cities.slug,
  contractType: jobs.contractType,
  seniority: jobs.seniority,
  modality: jobs.modality,
  salaryMin: jobs.salaryMin,
  salaryMax: jobs.salaryMax,
  salaryHidden: jobs.salaryHidden,
  description: jobs.description,
  whatsapp: jobs.whatsapp,
  featuredUntil: jobs.featuredUntil,
  postedAt: jobs.publishedAt,
  updatedAt: jobs.updatedAt,
};

type JobRow = {
  slug: string;
  title: string;
  company: string;
  companyLogo: string | null;
  categorySlug: string;
  citySlug: string;
  contractType: Job['contractType'];
  seniority: Job['seniority'];
  modality: Job['modality'];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryHidden: boolean;
  description: string;
  whatsapp: string | null;
  featuredUntil: Date | null;
  postedAt: Date | null;
  updatedAt: Date;
};

function toJob(row: JobRow): Job {
  return {
    slug: row.slug,
    title: row.title,
    company: row.company,
    companyLogo: row.companyLogo,
    categorySlug: row.categorySlug,
    citySlug: row.citySlug,
    contractType: row.contractType,
    seniority: row.seniority,
    modality: row.modality,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryHidden: row.salaryHidden,
    description: row.description,
    whatsapp: row.whatsapp,
    featuredUntil: row.featuredUntil ? row.featuredUntil.toISOString() : null,
    postedAt: row.postedAt ? row.postedAt.toISOString() : '',
    updatedAt: row.updatedAt.toISOString(),
  };
}

function baseQuery() {
  return db
    .select(jobSelection)
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .innerJoin(categories, eq(jobs.categoryId, categories.id))
    .innerJoin(cities, eq(jobs.cityId, cities.id));
}

// ---------------------------------------------------------------------------
// getJobs — filters, sort, pagination. Semantics must match lib/data.ts
// exactly (ARCHITECTURE.md §3).
// ---------------------------------------------------------------------------

export async function getJobs(filters: JobFilters): Promise<{ jobs: Job[]; total: number }> {
  const page = filters.page ?? 1;

  const conditions = [visiblePredicate()];
  if (filters.categoria) conditions.push(eq(categories.slug, filters.categoria));
  if (filters.ciudad) conditions.push(eq(cities.slug, filters.ciudad));
  if (filters.tipo) conditions.push(eq(jobs.contractType, filters.tipo as Job['contractType']));
  if (filters.nivel) conditions.push(eq(jobs.seniority, filters.nivel as Job['seniority']));
  if (filters.modality) conditions.push(eq(jobs.modality, filters.modality as Job['modality']));
  if (filters.salarioMin != null) {
    conditions.push(eq(jobs.salaryHidden, false));
    conditions.push(sql`${jobs.salaryMin} IS NOT NULL AND ${jobs.salaryMin} >= ${filters.salarioMin}`);
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(like(jobs.title, term), like(companies.name, term), like(jobs.description, term))!,
    );
  }

  const where = and(...conditions);

  const orderBy =
    filters.orden === 'salario'
      ? [desc(sql`COALESCE(${jobs.salaryMin}, 0)`), asc(isFeaturedSql()), asc(jobs.id)]
      : [asc(isFeaturedSql()), desc(jobs.publishedAt), asc(jobs.id)];

  const [rows, [{ total }]] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .innerJoin(categories, eq(jobs.categoryId, categories.id))
      .innerJoin(cities, eq(jobs.cityId, cities.id))
      .where(where),
  ]);

  return { jobs: (rows as JobRow[]).map(toJob), total };
}

export async function getJob(slug: string): Promise<Job | null> {
  const rows = await baseQuery().where(and(visiblePredicate(), eq(jobs.slug, slug))).limit(1);
  const row = (rows as JobRow[])[0];
  return row ? toJob(row) : null;
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  const rows = await baseQuery()
    .where(
      and(
        visiblePredicate(),
        sql`${jobs.featuredUntil} IS NOT NULL AND ${jobs.featuredUntil} > NOW()`,
      ),
    )
    .orderBy(asc(jobs.id))
    .limit(limit);
  return (rows as JobRow[]).map(toJob);
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  const rows = await baseQuery()
    .where(visiblePredicate())
    .orderBy(desc(jobs.publishedAt), asc(jobs.id))
    .limit(limit);
  return (rows as JobRow[]).map(toJob);
}

// ---------------------------------------------------------------------------
// Taxonomies — jobCount is a LEFT JOIN GROUP BY over published, non-expired
// jobs only, never a count of all rows.
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      jobCount: count(jobs.id),
    })
    .from(categories)
    .leftJoin(jobs, and(eq(jobs.categoryId, categories.id), visiblePredicate()))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));
  return rows;
}

export async function getCities(): Promise<City[]> {
  const rows = await db
    .select({
      slug: cities.slug,
      name: cities.name,
      jobCount: count(jobs.id),
    })
    .from(cities)
    .leftJoin(jobs, and(eq(jobs.cityId, cities.id), visiblePredicate()))
    .groupBy(cities.id)
    .orderBy(asc(cities.sortOrder));
  return rows;
}

export async function getCategory(slug: string): Promise<Category | null> {
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      jobCount: count(jobs.id),
    })
    .from(categories)
    .leftJoin(jobs, and(eq(jobs.categoryId, categories.id), visiblePredicate()))
    .where(eq(categories.slug, slug))
    .groupBy(categories.id)
    .limit(1);
  return rows[0] ?? null;
}

export async function getCity(slug: string): Promise<City | null> {
  const rows = await db
    .select({
      slug: cities.slug,
      name: cities.name,
      jobCount: count(jobs.id),
    })
    .from(cities)
    .leftJoin(jobs, and(eq(jobs.cityId, cities.id), visiblePredicate()))
    .where(eq(cities.slug, slug))
    .groupBy(cities.id)
    .limit(1);
  return rows[0] ?? null;
}
