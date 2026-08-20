import type { Job, Category, City, JobFilters } from './types';

// Seed imports — used when DATA_SOURCE !== 'db'
import rawJobs from './seed/jobs.json';
import rawCategories from './seed/categories.json';
import rawCities from './seed/cities.json';

// `images` did not exist when lib/seed/jobs.json was written, so every row
// needs a default rather than a cast masking `undefined` — an absent array
// there would fail the seed↔db parity check the moment a DB job has photos.
const seedJobs = (rawJobs as Job[]).map((job) => ({ ...job, images: job.images ?? [] }));
const seedCategories = rawCategories as Category[];
const seedCities = rawCities as City[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFeatured(job: Job): boolean {
  if (!job.featuredUntil) return false;
  return new Date(job.featuredUntil) > new Date();
}

function matchesFilters(job: Job, filters: JobFilters): boolean {
  if (filters.categoria && job.categorySlug !== filters.categoria) return false;
  if (filters.ciudad && job.citySlug !== filters.ciudad) return false;
  if (filters.tipo && job.contractType !== filters.tipo) return false;
  if (filters.nivel && job.seniority !== filters.nivel) return false;
  if (filters.modality && job.modality !== filters.modality) return false;
  if (filters.salarioMin != null) {
    if (job.salaryHidden || job.salaryMin == null) return false;
    if (job.salaryMin < filters.salarioMin) return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const searchable = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    if (!searchable.includes(q)) return false;
  }
  return true;
}

// The seed path's stand-in for `jobs.id`. scripts/seed-import.ts inserts
// lib/seed/jobs.json in file order, so the auto-increment id ascends with the
// array index — which makes the index the seed-side equivalent of the
// `asc(jobs.id)` that ends every ORDER BY in lib/db/queries.ts. Stated here
// because it is an assumption about a different file, and an unstated
// assumption is what the sort drift in PLAN-PHASE3-DRAFT.md §12.1 was made of.
const seedOrder = new Map(seedJobs.map((job, index) => [job.slug, index]));

function seedIndex(job: Job): number {
  return seedOrder.get(job.slug) ?? Number.MAX_SAFE_INTEGER;
}

/** 0 for a live featured job, 1 otherwise — mirrors `isFeaturedSql()`. */
function featuredRank(job: Job): number {
  return isFeatured(job) ? 0 : 1;
}

/**
 * Seed-side ORDER BY, mirroring lib/db/queries.ts key for key.
 *
 * The DB path is the source of truth (PLAN-PHASE3-DRAFT.md §13.4 B7) and has
 * exactly two orderings:
 *
 *   orden=salario   desc(COALESCE(salary_min, 0)), asc(is_featured), asc(id)
 *   everything else asc(is_featured), desc(published_at), asc(id)
 *
 * The previous version reached the same result for `salario` by concatenating
 * `[...featured, ...regular]` and relying on `Array.prototype.sort` being
 * stable. That was correct and invisible: nothing said the featured-first
 * grouping was a sort key, so any later edit that sorted the whole array first
 * would have silently dropped it, and `db:parity` only catches that if the seed
 * fixture happens to contain a salary tie between a featured and a regular job.
 * The keys are written out now instead of emerging from an ordering property of
 * two lines further up.
 */
function sortJobs(jobs: Job[], orden: JobFilters['orden']): Job[] {
  if (orden === 'salario') {
    return [...jobs].sort(
      (a, b) =>
        (b.salaryMin ?? 0) - (a.salaryMin ?? 0) ||
        featuredRank(a) - featuredRank(b) ||
        seedIndex(a) - seedIndex(b),
    );
  }

  // 'recientes', 'destacados' and 'relevancia' all land here, exactly as they
  // all land in the DB path's else branch — `destacados` floats featured jobs
  // to the top rather than filtering the rest out.
  return [...jobs].sort(
    (a, b) =>
      featuredRank(a) - featuredRank(b) ||
      new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime() ||
      seedIndex(a) - seedIndex(b),
  );
}

// ---------------------------------------------------------------------------
// Seed implementations
// ---------------------------------------------------------------------------

async function seedGetJobs(
  filters: JobFilters,
): Promise<{ jobs: Job[]; total: number }> {
  const PAGE_SIZE = 20;
  const page = filters.page ?? 1;

  const matched = seedJobs.filter((j) => matchesFilters(j, filters));
  const sorted = sortJobs(matched, filters.orden ?? 'recientes');
  const total = sorted.length;
  const jobs = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { jobs, total };
}

async function seedGetJob(slug: string): Promise<Job | null> {
  return seedJobs.find((j) => j.slug === slug) ?? null;
}

async function seedGetFeaturedJobs(limit = 6): Promise<Job[]> {
  // `asc(jobs.id)` on the DB side. `filter` already preserves file order, so
  // this sort changes nothing today — it states the key rather than inheriting
  // it from how the array happens to be built.
  return seedJobs
    .filter(isFeatured)
    .sort((a, b) => seedIndex(a) - seedIndex(b))
    .slice(0, limit);
}

async function seedGetRecentJobs(limit = 8): Promise<Job[]> {
  // `desc(jobs.published_at), asc(jobs.id)`. No featured float on either side.
  return [...seedJobs]
    .sort(
      (a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime() ||
        seedIndex(a) - seedIndex(b),
    )
    .slice(0, limit);
}

async function seedGetCategories(): Promise<Category[]> {
  return seedCategories.map((cat) => ({
    ...cat,
    jobCount: seedJobs.filter((j) => j.categorySlug === cat.slug).length,
  }));
}

async function seedGetCities(): Promise<City[]> {
  return seedCities.map((city) => ({
    ...city,
    jobCount: seedJobs.filter((j) => j.citySlug === city.slug).length,
  }));
}

async function seedGetCategory(slug: string): Promise<Category | null> {
  const cat = seedCategories.find((c) => c.slug === slug);
  if (!cat) return null;
  return { ...cat, jobCount: seedJobs.filter((j) => j.categorySlug === slug).length };
}

async function seedGetCity(slug: string): Promise<City | null> {
  const city = seedCities.find((c) => c.slug === slug);
  if (!city) return null;
  return { ...city, jobCount: seedJobs.filter((j) => j.citySlug === slug).length };
}

// ---------------------------------------------------------------------------
// DB backend
// ---------------------------------------------------------------------------

let dbModule: typeof import('./db/queries') | null = null;

async function getDbModule() {
  if (!dbModule) {
    dbModule = await import('./db/queries');
  }
  return dbModule;
}

type Source = 'seed' | 'db';

function getSource(): Source {
  // DATA_SOURCE is the two-valued switch (ARCHITECTURE.md §3, post-cutover).
  // Any value other than "db" (including unset) falls back to seed, so a
  // half-configured deploy can never accidentally serve an empty database.
  return process.env.DATA_SOURCE === 'db' ? 'db' : 'seed';
}

// ---------------------------------------------------------------------------
// Public API — THE SEAM. Only ever import from here, never from seed/*
// or db/queries.ts directly.
// ---------------------------------------------------------------------------

export async function getJobs(
  filters: JobFilters,
): Promise<{ jobs: Job[]; total: number }> {
  if (getSource() === 'db') return (await getDbModule()).getJobs(filters);
  return seedGetJobs(filters);
}

export async function getJob(slug: string): Promise<Job | null> {
  if (getSource() === 'db') return (await getDbModule()).getJob(slug);
  return seedGetJob(slug);
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  if (getSource() === 'db') return (await getDbModule()).getFeaturedJobs(limit);
  return seedGetFeaturedJobs(limit);
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  if (getSource() === 'db') return (await getDbModule()).getRecentJobs(limit);
  return seedGetRecentJobs(limit);
}

export async function getCategories(): Promise<Category[]> {
  if (getSource() === 'db') return (await getDbModule()).getCategories();
  return seedGetCategories();
}

export async function getCities(): Promise<City[]> {
  if (getSource() === 'db') return (await getDbModule()).getCities();
  return seedGetCities();
}

export async function getCategory(slug: string): Promise<Category | null> {
  if (getSource() === 'db') return (await getDbModule()).getCategory(slug);
  return seedGetCategory(slug);
}

export async function getCity(slug: string): Promise<City | null> {
  if (getSource() === 'db') return (await getDbModule()).getCity(slug);
  return seedGetCity(slug);
}
