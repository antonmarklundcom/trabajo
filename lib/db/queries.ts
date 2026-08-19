import { and, asc, desc, eq, gt, inArray, isNull, like, or, sql, count } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import { categories, cities, companies, jobImages, jobs } from './schema';
import { CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from '../cache-tags';
import { imagePublicUrl } from '../image-storage';
import { companyLogoSrc } from '../company-logo';
import type { Job, Category, City, JobFilters } from '../types';
import { isCacheable } from './job-cache-key';

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
  id: jobs.id,
  slug: jobs.slug,
  title: jobs.title,
  company: companies.name,
  companyLogoKey: companies.logoKey,
  companyLogoUrl: companies.logoUrl,
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
  id: number;
  slug: string;
  title: string;
  company: string;
  companyLogoKey: string | null;
  companyLogoUrl: string | null;
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

function toJob(row: JobRow, images: string[]): Job {
  return {
    slug: row.slug,
    title: row.title,
    company: row.company,
    companyLogo: companyLogoSrc(row.companyLogoKey, row.companyLogoUrl),
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
    images,
  };
}

/**
 * Batch-loads job_images for a page of rows and maps each to Job, rather than
 * one query per row — `getJobs` returns up to PAGE_SIZE (20) rows, and this
 * keeps that a fixed two queries instead of N+1. `imagePublicUrl()` is only
 * called for jobs that actually have image rows, so a deployment with
 * DATA_SOURCE=db but no IMAGE_STORAGE_DRIVER configured never touches it on
 * the (overwhelmingly common) job with zero photos.
 */
async function attachImages(rows: JobRow[]): Promise<Job[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const imageRows = await db
    .select({ jobId: jobImages.jobId, imageKey: jobImages.imageKey })
    .from(jobImages)
    .where(inArray(jobImages.jobId, ids))
    .orderBy(asc(jobImages.sortOrder), asc(jobImages.id));

  const byJobId = new Map<number, string[]>();
  for (const { jobId, imageKey } of imageRows) {
    const urls = byJobId.get(jobId) ?? [];
    urls.push(imagePublicUrl(imageKey));
    byJobId.set(jobId, urls);
  }

  return rows.map((row) => toJob(row, byJobId.get(row.id) ?? []));
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
// query* — the raw SQL. These are private on purpose: everything leaves this
// module through the cached wrappers at the bottom of the file, so there is no
// way to accidentally add an uncached public read path.
//
// queryJobs — filters, sort, pagination. Semantics must match lib/data.ts
// exactly (ARCHITECTURE.md §3).
// ---------------------------------------------------------------------------

async function queryJobs(filters: JobFilters): Promise<{ jobs: Job[]; total: number }> {
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

  return { jobs: await attachImages(rows as JobRow[]), total };
}

async function queryJob(slug: string): Promise<Job | null> {
  const rows = await baseQuery().where(and(visiblePredicate(), eq(jobs.slug, slug))).limit(1);
  const row = (rows as JobRow[])[0];
  if (!row) return null;
  const [job] = await attachImages([row]);
  return job;
}

async function queryFeaturedJobs(limit = 6): Promise<Job[]> {
  const rows = await baseQuery()
    .where(
      and(
        visiblePredicate(),
        sql`${jobs.featuredUntil} IS NOT NULL AND ${jobs.featuredUntil} > NOW()`,
      ),
    )
    .orderBy(asc(jobs.id))
    .limit(limit);
  return attachImages(rows as JobRow[]);
}

async function queryRecentJobs(limit = 8): Promise<Job[]> {
  const rows = await baseQuery()
    .where(visiblePredicate())
    .orderBy(desc(jobs.publishedAt), asc(jobs.id))
    .limit(limit);
  return attachImages(rows as JobRow[]);
}

// ---------------------------------------------------------------------------
// Taxonomies — jobCount is a LEFT JOIN GROUP BY over published, non-expired
// jobs only, never a count of all rows.
// ---------------------------------------------------------------------------

async function queryCategories(): Promise<Category[]> {
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

async function queryCities(): Promise<City[]> {
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

async function queryCategory(slug: string): Promise<Category | null> {
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

async function queryCity(slug: string): Promise<City | null> {
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

// ---------------------------------------------------------------------------
// The cached read path (ARCHITECTURE.md §8)
//
// Why a cache at all: a DB query has no `fetch` to hang `next: { revalidate }`
// on, so without this every render of every public page issues its own SQL.
// The pool is capped at `connectionLimit: 8` because Hostinger caps concurrent
// connections per user (DEPLOY.md), and /empleos is a dynamic route — it reads
// searchParams, so it re-renders per request and would issue 3 queries each
// time. That is the query storm this layer exists to stop.
//
// Why `unstable_cache` and not `use cache`: `use cache` requires
// `cacheComponents: true` in next.config.ts, which this app does not enable.
// See the long note in lib/cache.ts.
//
// Freshness after an admin write does NOT come from the `revalidate` timers
// below — it comes from `invalidatePublicContent()` in lib/cache.ts, called by
// every mutating handler under app/api/admin/*. The timers only bound the two
// transitions that have no write to hook onto (expiry and featured lapsing).
// ---------------------------------------------------------------------------

const cacheOptions = (tags: string[]) => ({
  revalidate: PUBLIC_CACHE_TTL_SECONDS,
  tags,
});

/**
 * `unstable_cache` derives its key from the stringified arguments, so an
 * object argument would produce a different entry for every key ORDER a caller
 * happens to use, and a separate entry for `{ page: 1 }` vs
 * `{ page: 1, q: undefined }`. Both are the same query. Canonicalise first:
 * drop empty values, sort the keys, and pass one string.
 */
function filtersKey(filters: JobFilters): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

const cachedJobs = unstable_cache(
  (key: string) => queryJobs(Object.fromEntries(JSON.parse(key)) as JobFilters),
  ['db', 'jobs', 'list'],
  cacheOptions([CACHE_TAGS.jobs]),
);

const cachedJob = unstable_cache((slug: string) => queryJob(slug), ['db', 'jobs', 'detail'], cacheOptions([CACHE_TAGS.jobs]));

const cachedFeaturedJobs = unstable_cache(
  (limit: number) => queryFeaturedJobs(limit),
  ['db', 'jobs', 'featured'],
  cacheOptions([CACHE_TAGS.jobs]),
);

const cachedRecentJobs = unstable_cache(
  (limit: number) => queryRecentJobs(limit),
  ['db', 'jobs', 'recent'],
  cacheOptions([CACHE_TAGS.jobs]),
);

// Taxonomy reads carry a published-job count, so they are invalidated by job
// writes as well as by taxonomy edits. `invalidatePublicContent()` fires both
// tags together for exactly this reason.
const cachedCategories = unstable_cache(
  () => queryCategories(),
  ['db', 'categories', 'list'],
  cacheOptions([CACHE_TAGS.taxonomies, CACHE_TAGS.jobs]),
);

const cachedCities = unstable_cache(
  () => queryCities(),
  ['db', 'cities', 'list'],
  cacheOptions([CACHE_TAGS.taxonomies, CACHE_TAGS.jobs]),
);

const cachedCategory = unstable_cache(
  (slug: string) => queryCategory(slug),
  ['db', 'categories', 'detail'],
  cacheOptions([CACHE_TAGS.taxonomies, CACHE_TAGS.jobs]),
);

const cachedCity = unstable_cache(
  (slug: string) => queryCity(slug),
  ['db', 'cities', 'detail'],
  cacheOptions([CACHE_TAGS.taxonomies, CACHE_TAGS.jobs]),
);

/**
 * `unstable_cache` requires Next's incrementalCache, which only exists inside
 * a Next server request/build — it throws `Invariant: incrementalCache
 * missing` when called from a plain script (tsx, no Next runtime), such as
 * scripts/parity-check.ts run via `npm run db:parity`. Falling back to the
 * uncached query in that one case is safe: the cache wrapper only memoizes
 * and revalidates `queryX`'s result, it never changes it, so parity's
 * seed-vs-db diff is comparing the same values either way. Any other error
 * (a real DB failure) still propagates.
 */
async function cachedOrRaw<T>(cached: () => Promise<T>, raw: () => Promise<T>): Promise<T> {
  try {
    return await cached();
  } catch (err) {
    if (err instanceof Error && err.message.includes('incrementalCache missing')) {
      return raw();
    }
    throw err;
  }
}

// The eight seam functions (ARCHITECTURE.md §3). Signatures and semantics are
// unchanged — only the caching is new — so lib/data.ts needs no edit.

export async function getJobs(filters: JobFilters): Promise<{ jobs: Job[]; total: number }> {
  // The taxonomy lists are cached and the calling page loads them in the same
  // render, so the membership check below is a warm read, not a second trip.
  const [categoryList, cityList] = await Promise.all([getCategories(), getCities()]);
  const cacheable = isCacheable(
    filters,
    new Set(categoryList.map((c) => c.slug)),
    new Set(cityList.map((c) => c.slug)),
  );

  if (!cacheable) return queryJobs(filters);

  return cachedOrRaw(() => cachedJobs(filtersKey(filters)), () => queryJobs(filters));
}

export async function getJob(slug: string): Promise<Job | null> {
  return cachedOrRaw(() => cachedJob(slug), () => queryJob(slug));
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  return cachedOrRaw(() => cachedFeaturedJobs(limit), () => queryFeaturedJobs(limit));
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  return cachedOrRaw(() => cachedRecentJobs(limit), () => queryRecentJobs(limit));
}

export async function getCategories(): Promise<Category[]> {
  return cachedOrRaw(() => cachedCategories(), () => queryCategories());
}

export async function getCities(): Promise<City[]> {
  return cachedOrRaw(() => cachedCities(), () => queryCities());
}

export async function getCategory(slug: string): Promise<Category | null> {
  return cachedOrRaw(() => cachedCategory(slug), () => queryCategory(slug));
}

export async function getCity(slug: string): Promise<City | null> {
  return cachedOrRaw(() => cachedCity(slug), () => queryCity(slug));
}
