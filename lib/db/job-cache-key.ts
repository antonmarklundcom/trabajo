// Pure cache-key policy for the public job list. No database import, no Next
// runtime — so scripts/verify-cache-key.ts can assert it directly, which is the
// point: every failure mode here is silent (an unbounded cache fills a disk, a
// colliding key serves one visitor's results to another).
import type { JobFilters, ContractType, Seniority, Modality } from '../types';

// ---------------------------------------------------------------------------
// Which job queries may be cached at all (PLAN-PHASE3-DRAFT.md §12.1, §13.2).
//
// Canonicalising the key was never the problem. The problem is CARDINALITY:
// every filter value arrives from the public query string, so every distinct
// `?q=` — and `?page=`, and `?categoria=` — minted a cache entry on disk. Any
// crawler could trip it by accident, and on shared Hostinger disk that is a
// resource-exhaustion vector.
//
// The obvious fix is to normalize and cap the free-text value. It is the wrong
// one: capping means truncating, truncating means two different searches
// sharing a key, and the failure mode of that is not a big cache — it is one
// visitor's result set served for another's query. A bounded cache is worth
// having; silently serving the wrong results is not, and §13.4 named that
// trade as the actual work in this PR.
//
// So the rule is the other direction, and it is one rule rather than a patch
// per parameter: a query is cached only when EVERY value in it comes from a
// closed set we control. Anything else is served straight from the database.
// No truncation anywhere, therefore no collision anywhere, and the cached key
// space is the genuinely finite one — taxonomy × enums × a bounded page range.
//
// Note what this costs, because it is not free: a free-text search now hits
// MySQL on every request instead of once per distinct term. Under the abuse
// case that is strictly cheaper than before — a crawler's random `?q=` was a
// cache MISS anyway, so it already cost a database query and now simply does
// not also cost a disk write. It is only worse for a genuinely popular
// repeated search, which is the trade being made deliberately.

const CACHEABLE_CONTRACT_TYPES: readonly string[] = [
  'tiempo_completo',
  'medio_tiempo',
  'temporal',
  'pasantia',
  'freelance',
] satisfies readonly ContractType[];

const CACHEABLE_SENIORITIES: readonly string[] = [
  'junior',
  'semi_senior',
  'senior',
  'sin_experiencia',
] satisfies readonly Seniority[];

const CACHEABLE_MODALITIES: readonly string[] = [
  'presencial',
  'remoto',
  'hibrido',
] satisfies readonly Modality[];

const CACHEABLE_ORDERS: readonly string[] = [
  'recientes',
  'salario',
  'destacados',
  'relevancia',
] satisfies readonly NonNullable<JobFilters['orden']>[];

// Deep pagination is not a real browse pattern; past this the pages are empty
// anyway and the only caller sending them is automated.
export const MAX_CACHED_PAGE = 50;

export function inClosedSet(value: string | undefined, allowed: readonly string[]): boolean {
  return value === undefined || value === '' || allowed.includes(value);
}

/**
 * True when this query's cache entry is one of a finite, known number.
 *
 * `q` and `salarioMin` are the two free-text inputs on the filter panel — open
 * by construction, so they are never cached rather than being squeezed into a
 * key that could collide. Taxonomy slugs are checked for MEMBERSHIP against
 * the category and city lists, which are themselves already cached and are
 * loaded by the same page render, so this costs nothing extra: an unknown
 * `?categoria=` is a 404-shaped browse and gets no entry of its own.
 */
export function isCacheable(
  filters: JobFilters,
  categorySlugs: ReadonlySet<string>,
  citySlugs: ReadonlySet<string>,
): boolean {
  if (filters.q !== undefined && filters.q !== '') return false;
  if (filters.salarioMin !== undefined) return false;

  const { page } = filters;
  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1 || page > MAX_CACHED_PAGE) return false;
  }

  if (!inClosedSet(filters.tipo, CACHEABLE_CONTRACT_TYPES)) return false;
  if (!inClosedSet(filters.nivel, CACHEABLE_SENIORITIES)) return false;
  if (!inClosedSet(filters.modality, CACHEABLE_MODALITIES)) return false;
  if (!inClosedSet(filters.orden, CACHEABLE_ORDERS)) return false;

  if (filters.categoria && !categorySlugs.has(filters.categoria)) return false;
  if (filters.ciudad && !citySlugs.has(filters.ciudad)) return false;

  return true;
}
