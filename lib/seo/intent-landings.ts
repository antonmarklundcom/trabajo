// The "type of work" landings: /trabajo-remoto, /trabajo-sin-experiencia,
// /trabajo-medio-tiempo (PLAN-SEO.md §1).
//
// Each one is a real, indexable URL for a slice of the catalogue the job row
// already records (modality, seniority, contract type) — the same idea as the
// category and city landings, for the query families "trabajo remoto
// paraguay", "trabajo sin experiencia", "trabajo medio tiempo". The matching
// single-filter /empleos URL canonicalises to its landing (lib/seo.ts), so
// the landing, not the filter permutation, is what Google indexes.
//
// Plain data, not server-only: lib/seo.ts imports it and scripts/verify-seo.ts
// evaluates lib/seo.ts under plain tsx.

export type IntentLandingKey = 'remoto' | 'sinExperiencia' | 'medioTiempo';

/** The /empleos query parameter a landing corresponds to, and its value. */
export type IntentFilter =
  | { param: 'modalidad'; value: 'remoto' }
  | { param: 'nivel'; value: 'sin_experiencia' }
  | { param: 'tipo'; value: 'medio_tiempo' };

export type IntentLanding = {
  path: string;
  /** Chip / footer label. */
  label: string;
  filter: IntentFilter;
};

export const INTENT_LANDINGS: Record<IntentLandingKey, IntentLanding> = {
  remoto: {
    path: '/trabajo-remoto',
    label: 'Trabajo remoto',
    filter: { param: 'modalidad', value: 'remoto' },
  },
  sinExperiencia: {
    path: '/trabajo-sin-experiencia',
    label: 'Sin experiencia',
    filter: { param: 'nivel', value: 'sin_experiencia' },
  },
  medioTiempo: {
    path: '/trabajo-medio-tiempo',
    label: 'Medio tiempo',
    filter: { param: 'tipo', value: 'medio_tiempo' },
  },
};

export const INTENT_LANDING_ORDER: IntentLandingKey[] = ['sinExperiencia', 'medioTiempo', 'remoto'];

/** The landing whose filter is exactly `param=value`, if any. */
export function intentLandingFor(param: string, value: string): IntentLanding | undefined {
  return Object.values(INTENT_LANDINGS).find(
    (l) => l.filter.param === param && l.filter.value === value,
  );
}
