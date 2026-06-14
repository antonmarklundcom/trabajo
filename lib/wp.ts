/**
 * Phase 2 WordPress + JetEngine backend.
 *
 * This file is NOT active in Phase 1 (USE_WP_BACKEND=false).
 * To activate: set WP_API_URL and USE_WP_BACKEND=true, then fill in the
 * TODO field names below to match the live JetEngine schema.
 *
 * IMPORTANT: This module is server-side only. It must never be imported
 * from a client component or called from the browser. All fetches go
 * server → WordPress, never browser → WordPress (no CORS needed).
 */

import type { Job, Category, City, JobFilters, ContractType, Seniority, Modality } from './types';

// Prevent accidental client-side import
if (typeof window !== 'undefined') {
  throw new Error('lib/wp.ts must only run on the server');
}

const BASE = process.env.WP_API_URL ?? 'https://panel.trabajo.com.py';

// Jobs may be a Custom Post Type (CPT) or a JetEngine Custom Content Type (CCT).
// TODO (Phase 2): confirm which endpoint JetEngine uses:
//   CPT:  GET ${BASE}/wp-json/wp/v2/empleos
//   CCT:  GET ${BASE}/wp-json/jet-cct/v1/empleos
// Adjust WP_JOBS_ENDPOINT below once confirmed.
const WP_JOBS_ENDPOINT = `${BASE}/wp-json/wp/v2/empleos`; // TODO: confirm

async function wpFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // TODO (Phase 2): Add WP Application Password auth header if needed:
      // Authorization: `Basic ${Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64')}`,
      ...(options?.headers ?? {}),
    },
    next: { revalidate: 60 }, // ISR: revalidate every 60 s
  });

  if (!res.ok) {
    throw new Error(`WP fetch failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Raw WordPress/JetEngine shape — TODO: confirm every field name against
// the live JetEngine schema before setting USE_WP_BACKEND=true
// ---------------------------------------------------------------------------
type RawWpJob = {
  // Standard WP fields
  id: number;
  slug: string;                         // WP post slug ✓
  date: string;                         // postedAt ✓
  modified: string;                     // updatedAt ✓
  title: { rendered: string };          // title ✓

  // JetEngine meta fields — TODO: verify every name in JetEngine field editor
  acf?: {
    company?: string;                   // TODO: confirm field name (may be 'empresa' or 'company_name')
    company_logo?: string;              // TODO: confirm (may be URL or attachment ID)
    category_slug?: string;             // TODO: confirm (may be a taxonomy term instead)
    city_slug?: string;                 // TODO: confirm (may be 'ciudad' or a relation field)
    contract_type?: string;             // TODO: confirm (may be 'tipo_contrato')
    seniority?: string;                 // TODO: confirm (may be 'nivel' or 'experiencia')
    modality?: string;                  // TODO: confirm (may be 'modalidad')
    salary_min?: number | null;         // TODO: confirm (may be 'salario_min')
    salary_max?: number | null;         // TODO: confirm (may be 'salario_max')
    salary_hidden?: boolean;            // TODO: confirm (may be 'a_convenir' or '0'/'1')
    description?: string;              // TODO: confirm (may use WP content field instead)
    whatsapp?: string | null;           // TODO: confirm (may be 'whatsapp_contacto')
    featured_until?: string | null;     // TODO: confirm (may be 'destacado_hasta')
  };
};

// Maps a raw WP/JetEngine job onto the frontend Job type.
// TODO (Phase 2): fill in all field names once confirmed against live schema.
export function mapWpJobToJob(raw: RawWpJob): Job {
  return {
    slug: raw.slug,
    title: raw.title.rendered,
    company: raw.acf?.company ?? '',               // TODO: confirm field name
    companyLogo: raw.acf?.company_logo ?? null,    // TODO: confirm field + handle attachment IDs
    categorySlug: raw.acf?.category_slug ?? '',    // TODO: confirm; may need taxonomy lookup
    citySlug: raw.acf?.city_slug ?? '',            // TODO: confirm field name
    contractType: (raw.acf?.contract_type as ContractType) ?? 'tiempo_completo', // TODO: confirm values
    seniority: (raw.acf?.seniority as Seniority) ?? 'junior',                   // TODO: confirm values
    modality: (raw.acf?.modality as Modality) ?? 'presencial',                  // TODO: confirm values
    salaryMin: raw.acf?.salary_min ?? null,        // TODO: confirm field name
    salaryMax: raw.acf?.salary_max ?? null,        // TODO: confirm field name
    salaryHidden: raw.acf?.salary_hidden ?? false, // TODO: confirm (may be '0'/'1' string)
    description: raw.acf?.description ?? '',       // TODO: may use raw.content.rendered instead
    whatsapp: raw.acf?.whatsapp ?? null,           // TODO: confirm field name
    featuredUntil: raw.acf?.featured_until ?? null, // TODO: confirm field name + date format
    postedAt: raw.date,
    updatedAt: raw.modified,
  };
}

// ---------------------------------------------------------------------------
// Public API matching lib/data.ts contract
// ---------------------------------------------------------------------------

export async function getJobs(
  filters: JobFilters,
): Promise<{ jobs: Job[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.categoria) params.set('category_slug', filters.categoria); // TODO: confirm param name
  if (filters.ciudad) params.set('city_slug', filters.ciudad);           // TODO: confirm param name
  if (filters.q) params.set('search', filters.q);
  if (filters.page) params.set('page', String(filters.page));
  params.set('per_page', '20');

  const url = `${WP_JOBS_ENDPOINT}?${params.toString()}`;
  const raw = await wpFetch<RawWpJob[]>(url);
  const jobs = raw.map(mapWpJobToJob);

  // TODO (Phase 2): read X-WP-Total header for total count
  return { jobs, total: jobs.length };
}

export async function getJob(slug: string): Promise<Job | null> {
  try {
    const raw = await wpFetch<RawWpJob[]>(`${WP_JOBS_ENDPOINT}?slug=${slug}`);
    if (!raw.length) return null;
    return mapWpJobToJob(raw[0]);
  } catch {
    return null;
  }
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  // TODO (Phase 2): confirm how featured jobs are queried in JetEngine
  // (may be a meta query on featured_until > NOW, or a dedicated endpoint)
  const raw = await wpFetch<RawWpJob[]>(
    `${WP_JOBS_ENDPOINT}?meta_key=featured_until&meta_compare=>&meta_value=${new Date().toISOString()}&per_page=${limit}`,
  );
  return raw.map(mapWpJobToJob);
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  const raw = await wpFetch<RawWpJob[]>(
    `${WP_JOBS_ENDPOINT}?orderby=date&order=desc&per_page=${limit}`,
  );
  return raw.map(mapWpJobToJob);
}

export async function getCategories(): Promise<Category[]> {
  // TODO (Phase 2): confirm categories endpoint — may be a WP taxonomy or JetEngine relation
  // Options: /wp-json/wp/v2/job_categories  OR  /wp-json/jet-cct/v1/categories
  throw new Error('WP getCategories not yet implemented — confirm JetEngine schema first');
}

export async function getCities(): Promise<City[]> {
  // TODO (Phase 2): confirm cities endpoint
  throw new Error('WP getCities not yet implemented — confirm JetEngine schema first');
}

export async function getCategory(slug: string): Promise<Category | null> {
  // TODO (Phase 2): implement once taxonomy/CCT endpoint is confirmed
  void slug;
  throw new Error('WP getCategory not yet implemented');
}

export async function getCity(slug: string): Promise<City | null> {
  // TODO (Phase 2): implement once cities endpoint is confirmed
  void slug;
  throw new Error('WP getCity not yet implemented');
}
