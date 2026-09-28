// The site's evergreen resource pages — CV, carta de presentación, entrevista,
// the labour-law tools — in one registry (PLAN-SEO.md).
//
// These are fixed routes with their copy in code, not blog posts: some carry
// an interactive tool (the aguinaldo calculator) or downloadable files, and
// all of them target a high-volume query whose URL must never move. The blog
// keeps the long tail. One list here so the footer, the homepage, the job
// detail page, each guide's "Seguí leyendo" block and the sitemap can never
// disagree about which guides exist or what they are called.
//
// Plain data, no server-only import: the footer renders it on every page.

export type GuideKey =
  | 'curriculum'
  | 'curriculumPlantillas'
  | 'curriculumSinExperiencia'
  | 'cartaPresentacion'
  | 'entrevista'
  | 'aguinaldo'
  | 'salarioMinimo'
  | 'preaviso'
  | 'contrato';

export type Guide = {
  href: string;
  /** Short label for links and the footer. */
  label: string;
  /** One line for link cards. */
  blurb: string;
  audience: 'postulantes' | 'empresas' | 'ambos';
  /**
   * The date the page's content was last reviewed, ISO `YYYY-MM-DD`. Shown on
   * the page ("Actualizado…"), used as the Article `dateModified` and as the
   * sitemap `lastModified` — so bump it whenever the copy changes, and only
   * then.
   */
  updated: string;
};

export const GUIDES: Record<GuideKey, Guide> = {
  curriculum: {
    href: '/curriculum-vitae',
    label: 'Curriculum vitae',
    blurb: 'Cómo hacer un CV para Paraguay, con ejemplos y formato.',
    audience: 'postulantes',
    updated: '2026-09-28',
  },
  curriculumPlantillas: {
    href: '/curriculum-vitae/plantillas',
    label: 'Plantillas de CV gratis',
    blurb: 'Modelos de curriculum en Word y PDF para descargar y llenar.',
    audience: 'postulantes',
    updated: '2026-09-28',
  },
  curriculumSinExperiencia: {
    href: '/curriculum-vitae/sin-experiencia',
    label: 'CV sin experiencia',
    blurb: 'Qué poner en tu primer curriculum, con un ejemplo.',
    audience: 'postulantes',
    updated: '2026-09-28',
  },
  cartaPresentacion: {
    href: '/carta-de-presentacion',
    label: 'Carta de presentación',
    blurb: 'Cómo escribirla, con ejemplos para correo y WhatsApp.',
    audience: 'postulantes',
    updated: '2026-09-28',
  },
  entrevista: {
    href: '/entrevista-de-trabajo',
    label: 'Entrevista de trabajo',
    blurb: 'Las preguntas más comunes y cómo responderlas.',
    audience: 'postulantes',
    updated: '2026-09-28',
  },
  aguinaldo: {
    href: '/calculadora-de-aguinaldo',
    label: 'Calculadora de aguinaldo',
    blurb: 'Calculá tu aguinaldo completo o proporcional.',
    audience: 'ambos',
    updated: '2026-09-28',
  },
  salarioMinimo: {
    href: '/salario-minimo',
    label: 'Salario mínimo 2026',
    blurb: 'Monto vigente, jornal, hora y horas extras.',
    audience: 'ambos',
    updated: '2026-09-28',
  },
  preaviso: {
    href: '/preaviso-e-indemnizacion',
    label: 'Preaviso e indemnización',
    blurb: 'Plazos de preaviso y cálculo de la indemnización por despido.',
    audience: 'ambos',
    updated: '2026-09-28',
  },
  contrato: {
    href: '/contrato-de-trabajo',
    label: 'Modelo de contrato de trabajo',
    blurb: 'Qué debe incluir un contrato de trabajo en Paraguay, con modelo.',
    audience: 'empresas',
    updated: '2026-09-28',
  },
};

export function guide(key: GuideKey): Guide {
  return GUIDES[key];
}

/** Every guide, in the order the footer and the sitemap list them. */
export const GUIDE_ORDER: GuideKey[] = [
  'curriculum',
  'curriculumPlantillas',
  'curriculumSinExperiencia',
  'cartaPresentacion',
  'entrevista',
  'aguinaldo',
  'salarioMinimo',
  'preaviso',
  'contrato',
];
