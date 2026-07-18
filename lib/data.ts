import type { Job, Category, City, JobFilters } from './types';

// Seed imports — used when USE_WP_BACKEND !== 'true'
import rawJobs from './seed/jobs.json';
import rawCategories from './seed/categories.json';
import rawCities from './seed/cities.json';

const seedJobs = rawJobs as Job[];
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

function sortJobs(jobs: Job[], orden: JobFilters['orden']): Job[] {
  const featured = jobs.filter(isFeatured);
  const regular = jobs.filter((j) => !isFeatured(j));

  const byDate = (a: Job, b: Job) =>
    new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();

  const bySalary = (a: Job, b: Job) => {
    const sa = a.salaryMin ?? 0;
    const sb = b.salaryMin ?? 0;
    return sb - sa;
  };

  if (orden === 'destacados') {
    return [...featured.sort(byDate), ...regular.sort(byDate)];
  }
  if (orden === 'salario') {
    return [...featured, ...regular].sort(bySalary);
  }
  // default: 'recientes' or 'relevancia' — featured float to top, then by date
  return [...featured.sort(byDate), ...regular.sort(byDate)];
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
  return seedJobs.filter(isFeatured).slice(0, limit);
}

async function seedGetRecentJobs(limit = 8): Promise<Job[]> {
  return [...seedJobs]
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
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
// WP backend (Phase 2)
// ---------------------------------------------------------------------------

let wpModule: typeof import('./wp') | null = null;

async function getWpModule() {
  if (!wpModule) {
    wpModule = await import('./wp');
  }
  return wpModule;
}

function isWpEnabled(): boolean {
  // Single source switch: the WP backend is active only when the flag is
  // exactly 'true'. Any other value (unset, 'false', etc.) reads the seed JSON
  // exactly as before. WP_API_URL is optional — lib/wp.ts defaults to the live
  // panel host when it is not provided.
  return process.env.USE_WP_BACKEND === 'true';
}

// ---------------------------------------------------------------------------
// Public API — THE SEAM. Only ever import from here, never from seed/* or wp.ts
// ---------------------------------------------------------------------------

export async function getJobs(
  filters: JobFilters,
): Promise<{ jobs: Job[]; total: number }> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getJobs(filters);
  }
  return seedGetJobs(filters);
}

export async function getJob(slug: string): Promise<Job | null> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getJob(slug);
  }
  return seedGetJob(slug);
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getFeaturedJobs(limit);
  }
  return seedGetFeaturedJobs(limit);
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getRecentJobs(limit);
  }
  return seedGetRecentJobs(limit);
}

export async function getCategories(): Promise<Category[]> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getCategories();
  }
  return seedGetCategories();
}

export async function getCities(): Promise<City[]> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getCities();
  }
  return seedGetCities();
}

export async function getCategory(slug: string): Promise<Category | null> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getCategory(slug);
  }
  return seedGetCategory(slug);
}

export async function getCity(slug: string): Promise<City | null> {
  if (isWpEnabled()) {
    const wp = await getWpModule();
    return wp.getCity(slug);
  }
  return seedGetCity(slug);
}
