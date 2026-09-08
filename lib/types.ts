export type ContractType =
  | 'tiempo_completo'
  | 'medio_tiempo'
  | 'temporal'
  | 'pasantia'
  | 'freelance';

export type Seniority =
  | 'junior'
  | 'semi_senior'
  | 'senior'
  | 'sin_experiencia';

export type Modality = 'presencial' | 'remoto' | 'hibrido';

export type Job = {
  slug: string;
  title: string;
  company: string;
  companyLogo: string | null;
  categorySlug: string;
  citySlug: string;
  contractType: ContractType;
  seniority: Seniority;
  modality: Modality;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryHidden: boolean;
  description: string;
  whatsapp: string | null;
  featuredUntil: string | null;
  /**
   * When the listing stops being public — `jobs.expires_at`, the other half of
   * the visibility predicate (lib/db/queries.ts).
   *
   * NOT `featuredUntil`. The two were conflated in the JobPosting JSON-LD,
   * which told Google that a listing's `validThrough` was the end of a paid
   * promotion — wrong on every unfeatured listing, and wrong in a way Search
   * Console reports as an error (PLAN-GROWTH.md §4 S3). Null means "no end
   * date", which is what most listings are and what Google accepts.
   */
  expiresAt: string | null;
  postedAt: string;
  updatedAt: string;
  /** The company's own site, for `hiringOrganization.sameAs`. Null when unset. */
  companyWebsite: string | null;
  /** Public URLs, already resolved — 0 to 3 (PLAN-IMAGES.md §5). */
  images: string[];
};

/**
 * What an expired or archived listing's URL still serves (PLAN-GROWTH.md §4
 * S3, §7 D6): enough to tell the visitor what used to be here and send them
 * somewhere useful, and deliberately nothing else — no description, no
 * WhatsApp number, no apply form, no JobPosting markup.
 *
 * A separate type rather than a `Job` with fields blanked out, because the two
 * come from different queries with different rules: a Job passes the
 * visibility predicate, a ClosedJob deliberately steps outside it.
 */
export type ClosedJob = {
  title: string;
  company: string;
  categorySlug: string;
  citySlug: string;
  /** ISO date the listing closed, or null when nothing recorded one. */
  closedAt: string | null;
};

export type Category = {
  slug: string;
  name: string;
  jobCount?: number;
};

export type City = {
  slug: string;
  name: string;
  jobCount?: number;
};

export type JobFilters = {
  categoria?: string;
  ciudad?: string;
  tipo?: string;
  nivel?: string;
  modality?: string;
  salarioMin?: number;
  /**
   * `relevancia` was removed in PLAN-GROWTH.md §4 S2: it was a fourth label
   * for the same ORDER BY `recientes` already produced, so it doubled the URL
   * permutations of every listing page while changing nothing a visitor saw.
   * `destacados` is kept because it IS the default order, not because it
   * differs from one.
   */
  orden?: 'recientes' | 'salario' | 'destacados';
  q?: string;
  page?: number;
};

export type LeadApplication = {
  type: 'application';
  jobSlug: string;
  jobTitle: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
};

export type LeadEmployerPost = {
  type: 'employer_post';
  companyName: string;
  contactName: string;
  contactWhatsapp: string;
  email?: string;
  jobTitle: string;
  categorySlug: string;
  citySlug: string;
  description: string;
};

export type Lead = LeadApplication | LeadEmployerPost;
