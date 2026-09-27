import type { ContractType, Seniority, Modality } from './types';

export function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return 'A convenir';
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-PY', { style: 'decimal', maximumFractionDigits: 0 }).format(n);
  if (min && max) return `Gs. ${fmt(min)} – ${fmt(max)}`;
  if (min) return `Desde Gs. ${fmt(min)}`;
  if (max) return `Hasta Gs. ${fmt(max)}`;
  return 'A convenir';
}

/**
 * "hoy", "ayer", "hace 3 días" … — the relative part on its own, so a label
 * can put its own verb in front ("Actualizado hace 2 días").
 */
export function relativeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 14) return 'hace 1 semana';
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  if (days < 60) return 'hace 1 mes';
  return `hace ${Math.floor(days / 30)} meses`;
}

/** True while a listing is younger than `days` — JobCard's "Nuevo" tag. */
export function isPostedWithin(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() < days * 86_400_000;
}

/** "Publicado hace 3 días" — the verb is part of the string. */
export function formatRelativeDate(iso: string): string {
  return `Publicado ${relativeAgo(iso)}`;
}

/**
 * "Último pedido de publicación" on the admin dashboard (PLAN-GROWTH.md §4
 * W5) — a missed W5 notification email is invisible in a browser, so the
 * panel names it out loud the same way PurgeStatus does for the purge sweep.
 */
export function formatLastSubmission(at: Date | null): string {
  if (at === null) return 'Todavía no hay pedidos';
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export function contractTypeLabel(type: ContractType): string {
  const labels: Record<ContractType, string> = {
    tiempo_completo: 'Tiempo completo',
    medio_tiempo: 'Medio tiempo',
    temporal: 'Temporal',
    pasantia: 'Pasantía',
    freelance: 'Freelance',
  };
  return labels[type];
}

export function seniorityLabel(seniority: Seniority): string {
  const labels: Record<Seniority, string> = {
    sin_experiencia: 'Sin experiencia',
    junior: 'Junior',
    semi_senior: 'Semi Senior',
    senior: 'Senior',
  };
  return labels[seniority];
}

export function modalityLabel(modality: Modality): string {
  const labels: Record<Modality, string> = {
    presencial: 'Presencial',
    remoto: 'Remoto',
    hibrido: 'Híbrido',
  };
  return labels[modality];
}

export function employmentTypeJsonLd(type: ContractType): string {
  const map: Record<ContractType, string> = {
    tiempo_completo: 'FULL_TIME',
    medio_tiempo: 'PART_TIME',
    temporal: 'TEMPORARY',
    pasantia: 'INTERN',
    freelance: 'CONTRACTOR',
  };
  return map[type];
}
