import { count } from 'drizzle-orm';
import { db } from '../lib/db';
import { categories, cities, companies, jobs } from '../lib/db/schema';
import type { Job, Category, City } from '../lib/types';

import rawJobs from '../lib/seed/jobs.json';
import rawCategories from '../lib/seed/categories.json';
import rawCities from '../lib/seed/cities.json';

const seedJobs = rawJobs as Job[];
const seedCategories = rawCategories as Category[];
const seedCities = rawCities as City[];

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
      .insert(categories)
      .values({ slug: cat.slug, name: cat.name, sortOrder: i, createdAt: new Date() })
      .onDuplicateKeyUpdate({ set: { name: cat.name, sortOrder: i } });
  }

  for (const [i, city] of seedCities.entries()) {
    await db
      .insert(cities)
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
      .insert(companies)
      .values({
        name,
        slug,
        logoUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onDuplicateKeyUpdate({ set: { name, logoUrl } });
  }

  const rows = await db.select({ id: companies.id, slug: companies.slug }).from(companies);
  const slugToId = new Map(rows.map((r) => [r.slug, r.id]));

  const nameToId = new Map<string, number>();
  for (const [name, slug] of nameToSlug) {
    const id = slugToId.get(slug);
    if (id != null) nameToId.set(name, id);
  }
  return nameToId;
}

async function importJobs(nameToCompanyId: Map<string, number>) {
  const categoryRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const cityRows = await db.select({ id: cities.id, slug: cities.slug }).from(cities);
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
      .insert(jobs)
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
  await importTaxonomies();
  const nameToCompanyId = await importCompanies();
  await importJobs(nameToCompanyId);

  const [{ jobCount }] = await db.select({ jobCount: count() }).from(jobs);
  const [{ catCount }] = await db.select({ catCount: count() }).from(categories);
  const [{ cityCount }] = await db.select({ cityCount: count() }).from(cities);

  console.log(`jobs: ${jobCount}, categories: ${catCount}, cities: ${cityCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
