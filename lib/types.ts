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
  postedAt: string;
  updatedAt: string;
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
  orden?: 'recientes' | 'salario' | 'destacados' | 'relevancia';
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
