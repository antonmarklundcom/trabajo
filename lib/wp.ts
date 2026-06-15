/**
 * Live WordPress + JetEngine backend.
 *
 * Active only when USE_WP_BACKEND=true (see lib/data.ts — the source switch).
 * When the switch is OFF the site reads the seed JSON exactly as before and
 * this module is never imported.
 *
 * IMPORTANT: This module is server-side only. It must never be imported from a
 * client component or called from the browser. All fetches go server → WordPress
 * (no CORS needed). Every fetch is cached via Next's Data Cache (ISR
 * `next.revalidate`) so the taxonomy, relation and media lookups are resolved at
 * build / revalidate time and shared across requests — not re-fetched per
 * request and not per job (no N+1).
 *
 * Mapping notes (live schema → Job type) and known ambiguities are documented
 * inline where they occur.
 */

import { cache } from 'react';
import type {
  Job,
  Category,
  City,
  JobFilters,
  ContractType,
  Seniority,
  Modality,
} from './types';

// Prevent accidental client-side import.
if (typeof window !== 'undefined') {
  throw new Error('lib/wp.ts must only run on the server');
}

const BASE = (process.env.WP_API_URL ?? 'https://panel.trabajo.com.py').replace(/\/$/, '');

// Custom Post Types confirmed live: empleos (jobs) and empresas (companies).
const JOBS_ENDPOINT = `${BASE}/wp-json/wp/v2/empleos`;
const COMPANIES_ENDPOINT = `${BASE}/wp-json/wp/v2/empresas`;
const CIUDAD_ENDPOINT = `${BASE}/wp-json/wp/v2/ciudad`;
const CATEGORIA_ENDPOINT = `${BASE}/wp-json/wp/v2/categoria`;
const MEDIA_ENDPOINT = `${BASE}/wp-json/wp/v2/media`;
// JetEngine relation #4 = empresa (parent) → empleos (children).
const REL_ENDPOINT = `${BASE}/wp-json/jet-rel/4`;

// ISR window. Long enough that the (cached) taxonomy/relation/media graph is
// reused across requests; short enough that new jobs appear within minutes.
const REVALIDATE = 300; // seconds

const PAGE_SIZE = 20; // matches the seed pagination contract in lib/data.ts
const WP_MAX_PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Low-level fetch
// ---------------------------------------------------------------------------

async function wpFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    // ISR: cached in the Next Data Cache and shared across requests.
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`WP fetch failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Raw live shapes (confirmed from the REST responses)
// ---------------------------------------------------------------------------

type RawWpJob = {
  id: number;
  slug: string;
  date: string; // postedAt
  modified: string; // updatedAt
  title: { rendered: string };
  content: { rendered: string }; // description (HTML)
  // Taxonomies arrive as term-ID arrays, e.g. ciudad:[7], categoria:[2].
  ciudad?: number[];
  categoria?: number[];
  meta?: {
    contract_type?: string; // already the correct slug
    seniority?: string; // already the correct slug
    modality?: string; // already the correct slug
    salary_min?: string | number; // STRING like "5000000"
    salary_max?: string | number; // STRING like "5000000"
    salary_hidden?: unknown[] | boolean; // [] = false, ["yes"] = true
    whatsapp?: string;
    featured_until?: number | string; // UNIX timestamp (seconds)
  };
};

type RawEmpresa = {
  id: number;
  title: { rendered: string };
  featured_media?: number; // attachment id (0 = none) → company logo
  meta?: {
    empresa_whatsapp?: string; // fallback whatsapp
  };
};

type RawTerm = { id: number; slug: string; name: string };

// jet-rel/4 full list: { [empresaId]: [{ child_object_id }, ...] }
type RawRelList = Record<string, Array<{ child_object_id: number | string }>>;

// ---------------------------------------------------------------------------
// Coercion helpers (live schema → Job field types)
// ---------------------------------------------------------------------------

// Decode the handful of HTML entities WordPress emits in *.rendered text fields
// (titles, company names, term names). Not a full HTML parser — just enough to
// keep plain-text fields clean.
function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// salary_min / salary_max arrive as STRINGS → number, or null when empty.
function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// salary_hidden: EMPTY ARRAY [] = false; ["yes"] = true.
function toBool(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  if (typeof value === 'number') return value !== 0;
  return false;
}

// featured_until: UNIX timestamp (seconds) → ISO date string, or null.
function toIsoDate(value: unknown): string | null {
  const n = toNumber(value);
  if (n == null || n === 0) return null;
  return new Date(n * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Cached lookup tables (resolved once per request via React cache, and once per
// revalidate window via the Data Cache underneath).
// ---------------------------------------------------------------------------

// term id → slug, plus name, for a custom taxonomy.
const getTermMap = cache(
  async (endpoint: string): Promise<Map<number, { slug: string; name: string }>> => {
    const map = new Map<number, { slug: string; name: string }>();
    for (let page = 1; ; page++) {
      const terms = await wpFetch<RawTerm[]>(
        `${endpoint}?per_page=${WP_MAX_PER_PAGE}&page=${page}&_fields=id,slug,name`,
      );
      for (const t of terms) {
        map.set(t.id, { slug: t.slug, name: decodeEntities(t.name) });
      }
      if (terms.length < WP_MAX_PER_PAGE) break;
    }
    return map;
  },
);

// job id → empresa id, built once from the full relation list.
const getJobEmpresaMap = cache(async (): Promise<Map<number, number>> => {
  const map = new Map<number, number>();
  try {
    const rel = await wpFetch<RawRelList>(REL_ENDPOINT);
    for (const [empresaId, children] of Object.entries(rel)) {
      const parent = Number(empresaId);
      for (const child of children ?? []) {
        map.set(Number(child.child_object_id), parent);
      }
    }
  } catch {
    // Relation unavailable → jobs simply render without employer data.
  }
  return map;
});

// empresa id → resolved company fields. Deduped: each empresa fetched once.
const getEmpresa = cache(
  async (id: number): Promise<{ company: string; companyLogo: string | null; whatsapp: string | null } | null> => {
    try {
      const empresa = await wpFetch<RawEmpresa>(`${COMPANIES_ENDPOINT}/${id}`);
      const company = decodeEntities(empresa.title?.rendered ?? '');
      const whatsapp = empresa.meta?.empresa_whatsapp?.trim() || null;
      const companyLogo = empresa.featured_media
        ? await getMediaUrl(empresa.featured_media)
        : null;
      return { company, companyLogo, whatsapp };
    } catch {
      return null;
    }
  },
);

// attachment id → public image URL. Deduped per id.
const getMediaUrl = cache(async (id: number): Promise<string | null> => {
  if (!id) return null;
  try {
    const media = await wpFetch<{ source_url?: string }>(`${MEDIA_ENDPOINT}/${id}?_fields=source_url`);
    return media.source_url ?? null;
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Mapping raw job → Job
// ---------------------------------------------------------------------------

async function assembleJob(
  raw: RawWpJob,
  ciudadMap: Map<number, { slug: string; name: string }>,
  categoriaMap: Map<number, { slug: string; name: string }>,
  jobEmpresaMap: Map<number, number>,
): Promise<Job> {
  const meta = raw.meta ?? {};

  // Employer is not on the job — resolve via the JetEngine relation.
  const empresaId = jobEmpresaMap.get(raw.id);
  const empresa = empresaId != null ? await getEmpresa(empresaId) : null;

  const ciudadId = raw.ciudad?.[0];
  const categoriaId = raw.categoria?.[0];

  // whatsapp: job meta first, empresa as fallback.
  const jobWhatsapp = meta.whatsapp?.trim() || null;

  return {
    slug: raw.slug,
    title: decodeEntities(raw.title?.rendered ?? ''),
    // NOTE: content.rendered is HTML; MarkdownContent expects markdown-ish text.
    // Mapped as-specified (content.rendered = description). See PR for the
    // rendering caveat.
    description: raw.content?.rendered ?? '',
    categorySlug: categoriaId != null ? categoriaMap.get(categoriaId)?.slug ?? '' : '',
    citySlug: ciudadId != null ? ciudadMap.get(ciudadId)?.slug ?? '' : '',
    contractType: (meta.contract_type as ContractType) || 'tiempo_completo',
    seniority: (meta.seniority as Seniority) || 'junior',
    modality: (meta.modality as Modality) || 'presencial',
    salaryMin: toNumber(meta.salary_min),
    salaryMax: toNumber(meta.salary_max),
    salaryHidden: toBool(meta.salary_hidden),
    whatsapp: jobWhatsapp ?? empresa?.whatsapp ?? null,
    featuredUntil: toIsoDate(meta.featured_until),
    company: empresa?.company ?? '',
    companyLogo: empresa?.companyLogo ?? null,
    postedAt: raw.date,
    updatedAt: raw.modified,
  };
}

// Fetch every job (paginated), then assemble all of them against the shared
// lookup tables. Cached per request so getJobs/getJob/getFeatured/getRecent all
// reuse one resolved list.
const getAllJobs = cache(async (): Promise<Job[]> => {
  const [ciudadMap, categoriaMap, jobEmpresaMap] = await Promise.all([
    getTermMap(CIUDAD_ENDPOINT),
    getTermMap(CATEGORIA_ENDPOINT),
    getJobEmpresaMap(),
  ]);

  const rawJobs: RawWpJob[] = [];
  for (let page = 1; ; page++) {
    const batch = await wpFetch<RawWpJob[]>(
      `${JOBS_ENDPOINT}?per_page=${WP_MAX_PER_PAGE}&page=${page}&orderby=date&order=desc` +
        `&_fields=id,slug,date,modified,title,content,ciudad,categoria,meta`,
    );
    rawJobs.push(...batch);
    if (batch.length < WP_MAX_PER_PAGE) break;
  }

  return Promise.all(
    rawJobs.map((raw) => assembleJob(raw, ciudadMap, categoriaMap, jobEmpresaMap)),
  );
});

// ---------------------------------------------------------------------------
// Filtering / sorting / pagination — identical contract to the seed path in
// lib/data.ts (kept in sync so the source switch is transparent).
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

  if (orden === 'salario') {
    return [...featured, ...regular].sort(bySalary);
  }
  // 'recientes' | 'destacados' | 'relevancia' | undefined → featured first, by date
  return [...featured.sort(byDate), ...regular.sort(byDate)];
}

// ---------------------------------------------------------------------------
// Public API — mirrors lib/data.ts contract
// ---------------------------------------------------------------------------

export async function getJobs(
  filters: JobFilters,
): Promise<{ jobs: Job[]; total: number }> {
  const all = await getAllJobs();
  const page = filters.page ?? 1;
  const matched = all.filter((j) => matchesFilters(j, filters));
  const sorted = sortJobs(matched, filters.orden ?? 'recientes');
  const total = sorted.length;
  const jobs = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { jobs, total };
}

export async function getJob(slug: string): Promise<Job | null> {
  const all = await getAllJobs();
  return all.find((j) => j.slug === slug) ?? null;
}

export async function getFeaturedJobs(limit = 6): Promise<Job[]> {
  const all = await getAllJobs();
  return all.filter(isFeatured).slice(0, limit);
}

export async function getRecentJobs(limit = 8): Promise<Job[]> {
  const all = await getAllJobs();
  return [...all]
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
    .slice(0, limit);
}

export async function getCategories(): Promise<Category[]> {
  const [termMap, jobs] = await Promise.all([getTermMap(CATEGORIA_ENDPOINT), getAllJobs()]);
  return [...termMap.values()].map((term) => ({
    slug: term.slug,
    name: term.name,
    jobCount: jobs.filter((j) => j.categorySlug === term.slug).length,
  }));
}

export async function getCities(): Promise<City[]> {
  const [termMap, jobs] = await Promise.all([getTermMap(CIUDAD_ENDPOINT), getAllJobs()]);
  return [...termMap.values()].map((term) => ({
    slug: term.slug,
    name: term.name,
    jobCount: jobs.filter((j) => j.citySlug === term.slug).length,
  }));
}

export async function getCategory(slug: string): Promise<Category | null> {
  const [termMap, jobs] = await Promise.all([getTermMap(CATEGORIA_ENDPOINT), getAllJobs()]);
  const term = [...termMap.values()].find((t) => t.slug === slug);
  if (!term) return null;
  return {
    slug: term.slug,
    name: term.name,
    jobCount: jobs.filter((j) => j.categorySlug === slug).length,
  };
}

export async function getCity(slug: string): Promise<City | null> {
  const [termMap, jobs] = await Promise.all([getTermMap(CIUDAD_ENDPOINT), getAllJobs()]);
  const term = [...termMap.values()].find((t) => t.slug === slug);
  if (!term) return null;
  return {
    slug: term.slug,
    name: term.name,
    jobCount: jobs.filter((j) => j.citySlug === slug).length,
  };
}
