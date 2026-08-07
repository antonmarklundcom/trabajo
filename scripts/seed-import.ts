// Imports lib/seed/*.json into MySQL. Idempotent: every write is an upsert
// keyed on the natural unique column (slug), so running it twice leaves the
// same 28 jobs rather than 56.
import { count } from 'drizzle-orm';
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import type { Job, Category, City } from '../lib/types';

import rawJobs from '../lib/seed/jobs.json';
import rawCategories from '../lib/seed/categories.json';
import rawCities from '../lib/seed/cities.json';

const seedJobs = rawJobs as Job[];
const seedCategories = rawCategories as Category[];
const seedCities = rawCities as City[];

// Bound in main() after the DATABASE_URL guard — lib/db builds its connection
// pool at module-evaluation time, so importing it at the top would throw a bare
// "DATABASE_URL is not set" before the readable guard could run.
let db: typeof import('../lib/db').db;
let schema: typeof import('../lib/db/schema');

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function importTaxonomies() {
  for (const [i, cat] of seedCategories.entries()) {
    await db
      .insert(schema.categories)
      .values({ slug: cat.slug, name: cat.name, sortOrder: i, createdAt: new Date() })
      .onDuplicateKeyUpdate({ set: { name: cat.name, sortOrder: i } });
  }

  for (const [i, city] of seedCities.entries()) {
    await db
      .insert(schema.cities)
      .values({ slug: city.slug, name: city.name, sortOrder: i, createdAt: new Date() })
      .onDuplicateKeyUpdate({ set: { name: city.name, sortOrder: i } });
  }
}

async function importCompanies(): Promise<Map<string, number>> {
  const distinctNames = new Map<string, { name: string; logoUrl: string | null }>();
  for (const job of seedJobs) {
    if (!distinctNames.has(job.company)) {
      distinctNames.set(job.company, { name: job.company, logoUrl: job.companyLogo });
    }
  }

  const usedSlugs = new Set<string>();
  const nameToSlug = new Map<string, string>();
  for (const { name } of distinctNames.values()) {
    let slug = slugify(name);
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${slugify(name)}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);
    nameToSlug.set(name, slug);
  }

  for (const { name, logoUrl } of distinctNames.values()) {
    const slug = nameToSlug.get(name)!;
    await db
      .insert(schema.companies)
      .values({
        name,
        slug,
        logoUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({ set: { name, logoUrl, updatedAt: new Date() } });
  }

  const rows = await db
    .select({ id: schema.companies.id, slug: schema.companies.slug })
    .from(schema.companies);
  const slugToId = new Map(rows.map((r) => [r.slug, r.id]));

  const nameToId = new Map<string, number>();
  for (const [name, slug] of nameToSlug) {
    const id = slugToId.get(slug);
    if (id != null) nameToId.set(name, id);
  }
  return nameToId;
}

async function importJobs(nameToCompanyId: Map<string, number>) {
  const categoryRows = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug })
    .from(schema.categories);
  const cityRows = await db
    .select({ id: schema.cities.id, slug: schema.cities.slug })
    .from(schema.cities);
  const categorySlugToId = new Map(categoryRows.map((r) => [r.slug, r.id]));
  const citySlugToId = new Map(cityRows.map((r) => [r.slug, r.id]));

  for (const job of seedJobs) {
    const companyId = nameToCompanyId.get(job.company);
    const categoryId = categorySlugToId.get(job.categorySlug);
    const cityId = citySlugToId.get(job.citySlug);
    if (!companyId || !categoryId || !cityId) {
      throw new Error(`Unresolved reference for job "${job.slug}"`);
    }

    const values = {
      slug: job.slug,
      title: job.title,
      companyId,
      categoryId,
      cityId,
      contractType: job.contractType,
      seniority: job.seniority,
      modality: job.modality,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryHidden: job.salaryHidden,
      description: job.description,
      whatsapp: job.whatsapp,
      status: 'published' as const,
      featuredUntil: job.featuredUntil ? new Date(job.featuredUntil) : null,
      publishedAt: new Date(job.postedAt),
      createdAt: new Date(job.postedAt),
      updatedAt: new Date(job.updatedAt),
    };

    await db
      .insert(schema.jobs)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          title: values.title,
          companyId: values.companyId,
          categoryId: values.categoryId,
          cityId: values.cityId,
          contractType: values.contractType,
          seniority: values.seniority,
          modality: values.modality,
          salaryMin: values.salaryMin,
          salaryMax: values.salaryMax,
          salaryHidden: values.salaryHidden,
          description: values.description,
          whatsapp: values.whatsapp,
          status: values.status,
          featuredUntil: values.featuredUntil,
          publishedAt: values.publishedAt,
          updatedAt: values.updatedAt,
        },
      });
  }
}

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Importing seed data into ${describeTarget(url)} ...`);

  ({ db } = await import('../lib/db'));
  schema = await import('../lib/db/schema');

  await importTaxonomies();
  const nameToCompanyId = await importCompanies();
  await importJobs(nameToCompanyId);

  const [{ jobCount }] = await db.select({ jobCount: count() }).from(schema.jobs);
  const [{ catCount }] = await db.select({ catCount: count() }).from(schema.categories);
  const [{ cityCount }] = await db.select({ cityCount: count() }).from(schema.cities);
  const [{ companyCount }] = await db.select({ companyCount: count() }).from(schema.companies);

  console.log(
    `jobs: ${jobCount}, companies: ${companyCount}, categories: ${catCount}, cities: ${cityCount}`,
  );
  console.log(
    `expected from seed — jobs: ${seedJobs.length}, categories: ${seedCategories.length}, cities: ${seedCities.length}`,
  );

  // The idempotency gate, enforced rather than eyeballed: a second run must not
  // duplicate rows. Anything above the seed count means an upsert key is wrong.
  if (jobCount !== seedJobs.length) {
    console.error(
      `\nFAIL: expected ${seedJobs.length} jobs, found ${jobCount}. ` +
        'The importer is not idempotent — check the unique key behind onDuplicateKeyUpdate.',
    );
    process.exit(1);
  }
  if (catCount !== seedCategories.length || cityCount !== seedCities.length) {
    console.error('\nFAIL: taxonomy counts do not match the seed files.');
    process.exit(1);
  }

  console.log('OK: row counts match the seed files.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
