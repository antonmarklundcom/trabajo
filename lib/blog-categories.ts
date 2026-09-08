// Single source for the blog's category list (PLAN-GROWTH.md §4 C1,
// PLAN-PHASE3-DRAFT.md §5.3): a wrong value must be impossible, not a quiet
// eighth category. This file has no server-only or database dependency so it
// can be imported by lib/db/schema.ts (the enum), lib/blog.ts (the public
// read path) AND components/admin/BlogPostForm.tsx ('use client') — before
// this file existed, those three each carried their own copy of the same
// seven slugs, which is three chances for one of them to drift.
// scripts/verify-blog.ts asserts this is the only array literal of category
// slugs in the repo.
export const BLOG_CATEGORIES = [
  'noticias',
  'analisis-laboral',
  'consejos-cv',
  'entrevistas',
  'derechos-laborales',
  'guias-por-sector',
  'para-empresas',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

// `analisis-laboral` keeps its stored value (§7 D4) — renaming it would move
// every published URL under it — only the label visitors read changes.
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  noticias: 'Noticias',
  'analisis-laboral': 'Mercado laboral',
  'consejos-cv': 'Consejos de CV',
  entrevistas: 'Entrevistas',
  'derechos-laborales': 'Derechos laborales',
  'guias-por-sector': 'Guías por sector',
  'para-empresas': 'Para empresas',
};

/**
 * Copy for each category's archive page (`/blog/categoria/{slug}`, shipped
 * in C2 once the ≥5-published-posts gate is met). Written now, alongside the
 * enum, so C2 has nothing left to invent about what a category *is* — only
 * the listing and pagination around it.
 */
export const BLOG_CATEGORY_COPY: Record<
  BlogCategory,
  { title: string; description: string; intro: string }
> = {
  noticias: {
    title: 'Noticias',
    description: 'Novedades del mercado laboral paraguayo y del portal.',
    intro: 'Novedades sobre el mercado laboral en Paraguay y sobre trabajo.com.py.',
  },
  'analisis-laboral': {
    title: 'Mercado laboral',
    description: 'Qué rubros contratan, dónde y con qué modalidad en Paraguay.',
    intro:
      'Un vistazo al mercado laboral paraguayo: qué rubros contratan más, en qué ciudades y bajo qué modalidad.',
  },
  'consejos-cv': {
    title: 'Consejos de CV',
    description: 'Cómo armar un CV que un reclutador en Paraguay lea hasta el final.',
    intro: 'Guías prácticas para armar tu CV y destacar en tu próxima postulación.',
  },
  entrevistas: {
    title: 'Entrevistas',
    description: 'Cómo prepararte para una entrevista de trabajo en Paraguay.',
    intro: 'Todo lo que necesitás saber para llegar preparado/a a tu próxima entrevista.',
  },
  'derechos-laborales': {
    title: 'Derechos laborales',
    description: 'Aguinaldo, IPS, vacaciones y liquidación: tus derechos como trabajador/a.',
    intro:
      'Información sobre tus derechos como trabajador/a en Paraguay, con fuente en el Código del Trabajo, el IPS y el MTESS. Esta nota es informativa y no reemplaza el asesoramiento de un profesional.',
  },
  'guias-por-sector': {
    title: 'Guías por sector',
    description: 'Cómo conseguir trabajo en cada rubro, sector por sector.',
    intro: 'Guías para conseguir trabajo en cada rubro, con lo que buscan los empleadores.',
  },
  'para-empresas': {
    title: 'Para empresas',
    description: 'Cómo publicar un aviso que reciba postulantes por WhatsApp.',
    intro: 'Recursos para empresas que publican avisos de empleo en trabajo.com.py.',
  },
};
