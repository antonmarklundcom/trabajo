// Diffs the seed and db read paths across a fixed filter/sort/page matrix.
// Run with DATABASE_URL set and DATA_SOURCE=db already populated via
// scripts/seed-import.ts. Any difference is a bug in the DB path.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import type { Job, Category, City, JobFilters } from '../lib/types';

let failures = 0;

function normalizeJob(job: Job) {
  return {
    ...job,
    featuredUntil: job.featuredUntil ? new Date(job.featuredUntil).getTime() : null,
    postedAt: job.postedAt ? new Date(job.postedAt).getTime() : null,
    updatedAt: new Date(job.updatedAt).getTime(),
  };
}

function normalizeJobs(jobs: Job[]) {
  return jobs.map(normalizeJob);
}

function diff(label: string, seedValue: unknown, dbValue: unknown) {
  const a = JSON.stringify(seedValue);
  const b = JSON.stringify(dbValue);
  if (a !== b) {
    failures += 1;
    console.error(`MISMATCH: ${label}`);
    console.error(`  seed: ${a}`);
    console.error(`  db:   ${b}`);
  }
}

async function withSource<T>(source: 'seed' | 'db', fn: () => Promise<T>): Promise<T> {
  process.env.DATA_SOURCE = source;
  return fn();
}

async function compareGetJobs(data: typeof import('../lib/data'), filters: JobFilters, label: string) {
  const seedResult = await withSource('seed', () => data.getJobs(filters));
  const dbResult = await withSource('db', () => data.getJobs(filters));
  diff(`getJobs(${label}).total`, seedResult.total, dbResult.total);
  diff(
    `getJobs(${label}).jobs`,
    normalizeJobs(seedResult.jobs).map((j) => j.slug),
    normalizeJobs(dbResult.jobs).map((j) => j.slug),
  );
  diff(`getJobs(${label}).jobs[full]`, normalizeJobs(seedResult.jobs), normalizeJobs(dbResult.jobs));
}

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Comparing seed vs. ${describeTarget(url)} ...`);

  // Fresh import so getSource() re-evaluates DATA_SOURCE on every call.
  const data = await import('../lib/data');
  const seedCategories = (await withSource('seed', () => data.getCategories())) as Category[];
  const seedCities = (await withSource('seed', () => data.getCities())) as City[];

  const ordenes: JobFilters['orden'][] = ['recientes', 'destacados', 'salario', 'relevancia'];
  const matrix: { filters: JobFilters; label: string }[] = [];

  for (const orden of ordenes) {
    matrix.push({ filters: { orden, page: 1 }, label: `orden=${orden} page=1` });
  }

  for (const cat of seedCategories) {
    matrix.push({ filters: { categoria: cat.slug, page: 1 }, label: `categoria=${cat.slug}` });
  }
  for (const city of seedCities) {
    matrix.push({ filters: { ciudad: city.slug, page: 1 }, label: `ciudad=${city.slug}` });
  }

  const tipos: string[] = ['tiempo_completo', 'medio_tiempo', 'temporal', 'pasantia', 'freelance'];
  for (const tipo of tipos) {
    matrix.push({ filters: { tipo, page: 1 }, label: `tipo=${tipo}` });
  }

  const niveles: string[] = ['sin_experiencia', 'junior', 'semi_senior', 'senior'];
  for (const nivel of niveles) {
    matrix.push({ filters: { nivel, page: 1 }, label: `nivel=${nivel}` });
  }

  const modalidades: string[] = ['presencial', 'remoto', 'hibrido'];
  for (const modality of modalidades) {
    matrix.push({ filters: { modality, page: 1 }, label: `modality=${modality}` });
  }

  for (const salarioMin of [0, 2000000, 3500000, 5000000]) {
    matrix.push({ filters: { salarioMin, page: 1 }, label: `salarioMin=${salarioMin}` });
  }

  for (const q of ['vendedor', 'CONTADOR', 'zona', 'xyz']) {
    matrix.push({ filters: { q, page: 1 }, label: `q=${q}` });
  }

  matrix.push({
    filters: { categoria: seedCategories[0].slug, ciudad: seedCities[0].slug, orden: 'salario', page: 1 },
    label: 'combo: categoria+ciudad+orden=salario',
  });
  matrix.push({
    filters: { orden: 'recientes', page: 2 },
    label: 'orden=recientes page=2',
  });

  for (const { filters, label } of matrix) {
    await compareGetJobs(data, filters, label);
  }

  // getJob for every seed job
  const { jobs: allSeedJobs } = await withSource('seed', () => data.getJobs({ page: 1 }));
  const allSeed = await withSource('seed', async () => {
    const combined: Job[] = [];
    let page = 1;
    for (;;) {
      const res = await data.getJobs({ page });
      combined.push(...res.jobs);
      if (combined.length >= res.total) break;
      page += 1;
    }
    return combined;
  });
  void allSeedJobs;

  for (const job of allSeed) {
    const seedJob = await withSource('seed', () => data.getJob(job.slug));
    const dbJob = await withSource('db', () => data.getJob(job.slug));
    diff(`getJob(${job.slug})`, seedJob && normalizeJob(seedJob), dbJob && normalizeJob(dbJob));
  }

  // getFeaturedJobs / getRecentJobs
  const seedFeatured = await withSource('seed', () => data.getFeaturedJobs(6));
  const dbFeatured = await withSource('db', () => data.getFeaturedJobs(6));
  diff('getFeaturedJobs(6)', normalizeJobs(seedFeatured), normalizeJobs(dbFeatured));

  const seedRecent = await withSource('seed', () => data.getRecentJobs(8));
  const dbRecent = await withSource('db', () => data.getRecentJobs(8));
  diff('getRecentJobs(8)', normalizeJobs(seedRecent), normalizeJobs(dbRecent));

  // Categories / cities (sitemap-relevant: name, slug, jobCount)
  const dbCategories = await withSource('db', () => data.getCategories());
  diff('getCategories()', seedCategories, dbCategories);

  const dbCities = await withSource('db', () => data.getCities());
  diff('getCities()', seedCities, dbCities);

  for (const cat of seedCategories) {
    const seedCat = await withSource('seed', () => data.getCategory(cat.slug));
    const dbCat = await withSource('db', () => data.getCategory(cat.slug));
    diff(`getCategory(${cat.slug})`, seedCat, dbCat);
  }
  for (const city of seedCities) {
    const seedCity = await withSource('seed', () => data.getCity(city.slug));
    const dbCity = await withSource('db', () => data.getCity(city.slug));
    diff(`getCity(${city.slug})`, seedCity, dbCity);
  }

  // Non-existent slug must return null on both paths
  diff(
    'getJob(nonexistent)',
    await withSource('seed', () => data.getJob('nonexistent-slug-zzz')),
    await withSource('db', () => data.getJob('nonexistent-slug-zzz')),
  );

  if (failures > 0) {
    console.error(`\n${failures} mismatch(es) found.`);
    process.exit(1);
  }
  console.log('Parity check passed: seed and db paths match across the full matrix.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
