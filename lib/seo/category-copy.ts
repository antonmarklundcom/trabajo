// Editorial copy for the ten job-category landings (PLAN-GROWTH.md §4 S5).
//
// Plain data, not server-only: `intro` renders on /trabajo/[categoria] and
// `related` drives the "Categorías relacionadas" cross-link block on both
// taxonomy levels. No invented numbers — nothing here states a count the
// site cannot itself back with a query result.
//
// The adjacency graph does not need to be symmetric (A relating to B does
// not require B to list A back) — each entry names the two categories a
// visitor in that field is plausibly also searching, which is not always
// a two-way relationship.
export type CategoryCopy = {
  /** 2–3 sentences: what the roles are, typical requirements. */
  intro: string;
  /** Sibling category slugs for "Categorías relacionadas". */
  related: string[];
};

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  contabilidad: {
    intro:
      'Los puestos de contabilidad y finanzas en Paraguay van desde asistentes contables hasta ' +
      'gerentes financieros, en empresas de todos los tamaños y en estudios contables. La mayoría ' +
      'pide manejo de herramientas como Excel y sistemas contables, además de conocimiento de la ' +
      'normativa tributaria paraguaya. Son mayormente posiciones de tiempo completo y presenciales.',
    related: ['administracion', 'ventas'],
  },
  ventas: {
    intro:
      'Las vacantes de ventas y comercial incluyen ejecutivos de cuenta, vendedores de campo y ' +
      'representantes comerciales, en rubros que van del retail a los servicios B2B. Se valora la ' +
      'experiencia en atención a clientes y el manejo de objetivos comerciales, aunque muchas ' +
      'empresas también toman perfiles sin experiencia previa para posiciones de entrada.',
    related: ['marketing', 'atencion-al-cliente'],
  },
  administracion: {
    intro:
      'Los roles de administración cubren desde asistentes administrativos hasta coordinadores de ' +
      'oficina, en empresas de cualquier rubro que necesiten organizar procesos internos, ' +
      'documentación y compras. Se pide manejo de herramientas ofimáticas y, en muchos casos, ' +
      'experiencia previa en tareas similares.',
    related: ['contabilidad', 'atencion-al-cliente'],
  },
  'atencion-al-cliente': {
    intro:
      'Atención al cliente agrupa puestos de call center, soporte y mesa de ayuda, tanto ' +
      'presenciales como remotos. Buena comunicación oral y escrita es el requisito más constante, ' +
      'y varias posiciones no piden experiencia previa. Los horarios suelen ser por turnos.',
    related: ['administracion', 'ventas'],
  },
  tecnologia: {
    intro:
      'Tecnología e IT reúne desde desarrollo de software hasta soporte técnico y administración ' +
      'de sistemas, con demanda tanto de empresas locales como de compañías que contratan para ' +
      'clientes en el exterior. El nivel de experiencia pedido varía mucho según el puesto, y la ' +
      'modalidad remota o híbrida es más común acá que en otras categorías.',
    related: ['marketing', 'administracion'],
  },
  salud: {
    intro:
      'Salud y bienestar incluye personal médico, de enfermería y de apoyo administrativo en ' +
      'clínicas, hospitales y consultorios. La mayoría de los puestos piden título o matrícula ' +
      'habilitante según el rol, y la modalidad es presencial por la naturaleza del trabajo.',
    related: ['atencion-al-cliente', 'administracion'],
  },
  gastronomia: {
    intro:
      'Gastronomía y hotelería abarca cocina, salón, recepción y limpieza en restaurantes, bares y ' +
      'hoteles. Muchos puestos no piden experiencia previa y ofrecen capacitación en el lugar, ' +
      'aunque los roles de cocina suelen valorar formación o trayectoria específica.',
    related: ['atencion-al-cliente', 'logistica'],
  },
  logistica: {
    intro:
      'Logística y transporte incluye choferes, operadores de depósito y coordinadores de ' +
      'distribución, en empresas de comercio, industria y delivery. Licencia de conducir ' +
      'habilitante es un requisito frecuente para los roles de transporte, y la modalidad es ' +
      'presencial en la gran mayoría de los casos.',
    related: ['construccion', 'gastronomia'],
  },
  construccion: {
    intro:
      'Construcción e industria agrupa desde mano de obra calificada hasta supervisión de obra y ' +
      'roles técnicos en plantas industriales. La experiencia previa en el rubro específico pesa ' +
      'más que en otras categorías, y varios puestos piden certificaciones de seguridad laboral.',
    related: ['logistica', 'tecnologia'],
  },
  marketing: {
    intro:
      'Marketing y comunicación cubre community management, diseño, contenido y roles de marca en ' +
      'empresas y agencias. Se pide manejo de redes sociales y herramientas de diseño o edición ' +
      'según el puesto, con buena proporción de trabajo remoto o híbrido frente a otras categorías.',
    related: ['ventas', 'tecnologia'],
  },
};

export function categoryCopyFor(slug: string): CategoryCopy | null {
  return CATEGORY_COPY[slug] ?? null;
}
