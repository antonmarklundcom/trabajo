// Category/city option lookups (id + slug + name), shared by admin AND
// employer forms.
//
// Deliberately its own module rather than living in lib/db/admin.ts: employer
// routes may only read through lib/db/employer.ts (AGENTS.md), and adding a
// non-company-scoped export there would break that file's one mechanically-
// checkable rule ("every export takes companyId first"). Categories and
// cities are public taxonomy data with no per-tenant scoping to enforce, so
// neither module's invariant actually applies to them — this file is the
// neutral home. lib/db/admin.ts re-exports these so existing admin imports
// are unaffected.
import 'server-only';

import { asc } from 'drizzle-orm';
import { categories, cities } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

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
