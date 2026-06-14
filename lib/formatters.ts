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

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Publicado hoy';
  if (days === 1) return 'Publicado ayer';
  if (days < 7) return `Publicado hace ${days} días`;
  if (days < 14) return 'Publicado hace 1 semana';
  if (days < 30) return `Publicado hace ${Math.floor(days / 7)} semanas`;
  if (days < 60) return 'Publicado hace 1 mes';
  return `Publicado hace ${Math.floor(days / 30)} meses`;
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
