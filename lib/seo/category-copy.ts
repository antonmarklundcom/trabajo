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
  /**
   * The role names people actually search for in this field ("cajeras",
   * "empleos de chofer", "auxiliar administrativo" — PLAN-SEO.md §1 Q6),
   * appended to the landing's <title> after a colon. Short: the title
   * already carries the category name and the brand.
   */
  titleRoles: string;
  /** "Puestos más buscados": 2–3 roles, one or two sentences each. */
  roles: { name: string; text: string }[];
};

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  contabilidad: {
    intro:
      'Los puestos de contabilidad y finanzas en Paraguay van desde asistentes contables hasta ' +
      'gerentes financieros, en empresas de todos los tamaños y en estudios contables. La mayoría ' +
      'pide manejo de herramientas como Excel y sistemas contables, además de conocimiento de la ' +
      'normativa tributaria paraguaya. Son mayormente posiciones de tiempo completo y presenciales.',
    related: ['administracion', 'ventas'],
    titleRoles: 'auxiliar contable y contador',
    roles: [
      { name: 'Auxiliar contable', text: 'Registra facturas, concilia cuentas y prepara la información para las liquidaciones de IVA e IRE. Es el puesto de entrada más común, muchas veces abierto a estudiantes de Contabilidad.' },
      { name: 'Contador/a', text: 'Lleva la contabilidad completa, presenta las declaraciones ante la DNIT y firma los balances. Se pide título de contador público y, en general, experiencia.' },
      { name: 'Analista financiero', text: 'Arma presupuestos, flujos de caja y reportes para la gerencia; se valora mucho el manejo avanzado de Excel.' },
    ],
  },
  ventas: {
    intro:
      'Las vacantes de ventas y comercial incluyen ejecutivos de cuenta, vendedores de campo y ' +
      'representantes comerciales, en rubros que van del retail a los servicios B2B. Se valora la ' +
      'experiencia en atención a clientes y el manejo de objetivos comerciales, aunque muchas ' +
      'empresas también toman perfiles sin experiencia previa para posiciones de entrada.',
    related: ['marketing', 'atencion-al-cliente'],
    titleRoles: 'vendedores y asesores comerciales',
    roles: [
      { name: 'Vendedor/a de salón', text: 'Atiende a clientes en un local o shopping, cobra y repone. Es de los puestos que más aceptan perfiles sin experiencia.' },
      { name: 'Asesor/a comercial', text: 'Busca clientes nuevos y cierra ventas, muchas veces con sueldo base más comisiones y objetivos mensuales.' },
      { name: 'Chofer vendedor / preventista', text: 'Recorre una zona visitando comercios para tomar pedidos o entregar mercadería; suele pedir licencia de conducir.' },
    ],
  },
  administracion: {
    intro:
      'Los roles de administración cubren desde asistentes administrativos hasta coordinadores de ' +
      'oficina, en empresas de cualquier rubro que necesiten organizar procesos internos, ' +
      'documentación y compras. Se pide manejo de herramientas ofimáticas y, en muchos casos, ' +
      'experiencia previa en tareas similares.',
    related: ['contabilidad', 'atencion-al-cliente'],
    titleRoles: 'auxiliar administrativo y recepcionista',
    roles: [
      { name: 'Auxiliar administrativo/a', text: 'Carga datos, archiva documentos, hace pagos y atiende proveedores. Es uno de los puestos más buscados de Paraguay y el punto de entrada a la administración.' },
      { name: 'Asistente administrativo/a', text: 'Apoya a una gerencia o área: agenda, compras, informes y seguimiento de trámites.' },
      { name: 'Recepcionista', text: 'Atiende el teléfono, recibe a las visitas y organiza la agenda; se pide buena presencia y trato cordial.' },
    ],
  },
  'atencion-al-cliente': {
    intro:
      'Atención al cliente agrupa puestos de call center, soporte y mesa de ayuda, tanto ' +
      'presenciales como remotos. Buena comunicación oral y escrita es el requisito más constante, ' +
      'y varias posiciones no piden experiencia previa. Los horarios suelen ser por turnos.',
    related: ['administracion', 'ventas'],
    titleRoles: 'cajeras, call center y más',
    roles: [
      { name: 'Cajero/a', text: 'Cobra en supermercados, farmacias, tiendas o bancos y cuadra la caja al cierre del turno. Muchas empresas contratan cajeras sin experiencia y las capacitan.' },
      { name: 'Agente de call center', text: 'Atiende llamadas o chats de clientes, en turnos rotativos y a veces desde casa.' },
      { name: 'Atención al cliente', text: 'Resuelve consultas y reclamos en sucursal o por WhatsApp; la comunicación clara es el requisito principal.' },
    ],
  },
  tecnologia: {
    intro:
      'Tecnología e IT reúne desde desarrollo de software hasta soporte técnico y administración ' +
      'de sistemas, con demanda tanto de empresas locales como de compañías que contratan para ' +
      'clientes en el exterior. El nivel de experiencia pedido varía mucho según el puesto, y la ' +
      'modalidad remota o híbrida es más común acá que en otras categorías.',
    related: ['marketing', 'administracion'],
    titleRoles: 'programador, soporte e IT',
    roles: [
      { name: 'Programador/a', text: 'Desarrolla sistemas web o móviles; hay puestos junior para quienes muestran proyectos propios aunque no tengan experiencia formal.' },
      { name: 'Soporte técnico', text: 'Resuelve problemas de equipos, redes y usuarios dentro de una empresa o para sus clientes.' },
      { name: 'Analista de datos', text: 'Arma reportes y tableros a partir de las bases de datos de la empresa.' },
    ],
  },
  salud: {
    intro:
      'Salud y bienestar incluye personal médico, de enfermería y de apoyo administrativo en ' +
      'clínicas, hospitales y consultorios. La mayoría de los puestos piden título o matrícula ' +
      'habilitante según el rol, y la modalidad es presencial por la naturaleza del trabajo.',
    related: ['atencion-al-cliente', 'administracion'],
    titleRoles: 'enfermería y personal de salud',
    roles: [
      { name: 'Enfermero/a', text: 'Trabaja en sanatorios, clínicas o atención domiciliaria, casi siempre por turnos; se pide título y registro habilitante.' },
      { name: 'Auxiliar de enfermería', text: 'Asiste al equipo de enfermería en la atención de pacientes; es una salida laboral rápida después de una formación técnica.' },
      { name: 'Recepción y administración médica', text: 'Agenda turnos, atiende pacientes y gestiona seguros médicos en consultorios y clínicas.' },
    ],
  },
  gastronomia: {
    intro:
      'Gastronomía y hotelería abarca cocina, salón, recepción y limpieza en restaurantes, bares y ' +
      'hoteles. Muchos puestos no piden experiencia previa y ofrecen capacitación en el lugar, ' +
      'aunque los roles de cocina suelen valorar formación o trayectoria específica.',
    related: ['atencion-al-cliente', 'logistica'],
    titleRoles: 'mozos, cocina y hotelería',
    roles: [
      { name: 'Mozo/a', text: 'Atiende mesas en restaurantes, bares y eventos; suele haber turnos de noche y de fin de semana.' },
      { name: 'Ayudante de cocina', text: 'Prepara ingredientes, mantiene la limpieza y apoya al cocinero. Es de los puestos que más contratan sin experiencia.' },
      { name: 'Recepcionista de hotel', text: 'Hace el check-in y check-out y atiende a los huéspedes; el inglés o el portugués suman mucho.' },
    ],
  },
  logistica: {
    intro:
      'Logística y transporte incluye choferes, operadores de depósito y coordinadores de ' +
      'distribución, en empresas de comercio, industria y delivery. Licencia de conducir ' +
      'habilitante es un requisito frecuente para los roles de transporte, y la modalidad es ' +
      'presencial en la gran mayoría de los casos.',
    related: ['construccion', 'gastronomia'],
    titleRoles: 'choferes, reparto y depósito',
    roles: [
      { name: 'Chofer', text: 'Conduce camiones, utilitarios o vehículos particulares; se pide licencia de conducir de la categoría correspondiente y, para algunos puestos, antecedente policial.' },
      { name: 'Repartidor / delivery', text: 'Entrega pedidos en moto o auto propio o de la empresa, muchas veces por zona y por turnos.' },
      { name: 'Operario/a de depósito', text: 'Recibe, ordena y despacha mercadería; en depósitos grandes se valora saber manejar montacargas.' },
    ],
  },
  construccion: {
    intro:
      'Construcción e industria agrupa desde mano de obra calificada hasta supervisión de obra y ' +
      'roles técnicos en plantas industriales. La experiencia previa en el rubro específico pesa ' +
      'más que en otras categorías, y varios puestos piden certificaciones de seguridad laboral.',
    related: ['logistica', 'tecnologia'],
    titleRoles: 'obreros, técnicos y operarios',
    roles: [
      { name: 'Albañil y ayudante de obra', text: 'Trabajo en obras de construcción, muchas veces por jornal; la experiencia comprobable pesa más que los estudios.' },
      { name: 'Operario/a de planta', text: 'Trabaja en líneas de producción de fábricas e industrias, en turnos rotativos.' },
      { name: 'Técnico/a electricista o mecánico', text: 'Mantenimiento de equipos e instalaciones; se piden estudios técnicos o certificaciones.' },
    ],
  },
  marketing: {
    intro:
      'Marketing y comunicación cubre community management, diseño, contenido y roles de marca en ' +
      'empresas y agencias. Se pide manejo de redes sociales y herramientas de diseño o edición ' +
      'según el puesto, con buena proporción de trabajo remoto o híbrido frente a otras categorías.',
    related: ['ventas', 'tecnologia'],
    titleRoles: 'community manager y diseño',
    roles: [
      { name: 'Community manager', text: 'Gestiona las redes sociales de una marca: contenido, publicaciones y respuesta a mensajes.' },
      { name: 'Diseñador/a gráfico/a', text: 'Crea piezas para redes, impresos y web; el portafolio pesa más que el título.' },
      { name: 'Asistente de marketing', text: 'Apoya campañas, eventos y la medición de resultados; buen punto de entrada al área.' },
    ],
  },
};

export function categoryCopyFor(slug: string): CategoryCopy | null {
  return CATEGORY_COPY[slug] ?? null;
}
