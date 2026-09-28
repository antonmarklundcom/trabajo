// Example CVs rendered as page content on the CV guides (PLAN-SEO.md §0,
// "curriculum vitae ejemplos" / "ejemplo de cv" / "modelo de curriculum").
// Invented people with placeholder contact data — never a real candidate.

export type CvEntry = { left: string; right?: string; bullets?: string[] };
export type CvSection = { title: string; text?: string; entries?: CvEntry[] };
export type CvExample = {
  id: string;
  /** What the example is for — shown above the sheet. */
  caption: string;
  name: string;
  headline: string;
  contact: string;
  sections: CvSection[];
};

export const CV_EXAMPLES: Record<'administrativo' | 'sinExperiencia' | 'chofer', CvExample> = {
  administrativo: {
    id: 'ejemplo-auxiliar-administrativo',
    caption: 'Ejemplo de CV con experiencia: auxiliar administrativa (formato cronológico)',
    name: 'Laura Benítez',
    headline: 'Auxiliar administrativa',
    contact: 'Fernando de la Mora · WhatsApp 09XX XXX XXX · laura.benitez@correo.com',
    sections: [
      {
        title: 'Perfil',
        text: 'Auxiliar administrativa con 3 años de experiencia en facturación, cobranzas y atención a proveedores. Manejo de Excel intermedio y sistemas de gestión. Busco sumarme al área administrativa de una empresa en Gran Asunción.',
      },
      {
        title: 'Experiencia laboral',
        entries: [
          {
            left: 'Auxiliar administrativa — Distribuidora [Nombre], Asunción',
            right: '03/2023 – Actualidad',
            bullets: [
              'Emisión de facturas y notas de crédito; control diario de cobranzas.',
              'Carga de compras y conciliación de cuentas con proveedores.',
              'Archivo de documentación y apoyo en la preparación de informes mensuales.',
            ],
          },
          {
            left: 'Recepcionista — Consultorio [Nombre], San Lorenzo',
            right: '02/2021 – 02/2023',
            bullets: ['Agenda de turnos, atención telefónica y cobro de consultas.'],
          },
        ],
      },
      {
        title: 'Formación',
        entries: [
          { left: 'Licenciatura en Administración (4.º año) — [Universidad]', right: 'En curso' },
          { left: 'Bachillerato Técnico en Contabilidad — [Colegio]', right: '2020' },
        ],
      },
      { title: 'Habilidades', text: 'Excel intermedio (tablas dinámicas, BUSCARV) · Facturación electrónica · Atención a proveedores' },
      { title: 'Idiomas', text: 'Castellano: nativo · Guaraní: fluido · Inglés: básico' },
      { title: 'Referencias', text: 'Disponibles a pedido.' },
    ],
  },
  sinExperiencia: {
    id: 'ejemplo-cv-sin-experiencia',
    caption: 'Ejemplo de CV sin experiencia laboral (formato funcional)',
    name: 'María González',
    headline: 'Atención al cliente · Ventas · Caja',
    contact: 'San Lorenzo · WhatsApp 09XX XXX XXX · maria.gonzalez@correo.com',
    sections: [
      {
        title: 'Perfil',
        text: 'Estudiante de Administración de Empresas. Busco mi primer empleo en atención al cliente, caja o ventas. Tengo experiencia atendiendo público y manejando caja en el negocio familiar.',
      },
      {
        title: 'Formación',
        entries: [
          { left: 'Administración de Empresas (2.º año, turno noche) — [Universidad]', right: 'En curso' },
          { left: 'Bachillerato Técnico en Contabilidad — [Colegio], San Lorenzo', right: '2024' },
        ],
      },
      {
        title: 'Experiencia práctica',
        entries: [
          {
            left: 'Despensa familiar — atención al cliente y caja',
            right: '2022 – Actualidad',
            bullets: ['Atención de clientes, cobro y cierre de caja diario.', 'Reposición de mercadería y control de vencimientos.'],
          },
          {
            left: 'Venta de ropa por Instagram — emprendimiento propio',
            right: '2023 – 2024',
            bullets: ['Respuesta de consultas por WhatsApp y coordinación de entregas.'],
          },
        ],
      },
      { title: 'Habilidades', text: 'Manejo de caja · Excel básico · Atención presencial y por WhatsApp' },
      { title: 'Idiomas', text: 'Castellano: nativo · Guaraní: fluido' },
      { title: 'Disponibilidad', text: 'Lunes a sábado, de mañana y tarde. Zona Gran Asunción.' },
    ],
  },
  chofer: {
    id: 'ejemplo-cv-chofer',
    caption: 'Ejemplo de CV básico para un puesto operativo: chofer repartidor',
    name: 'Carlos Ramírez',
    headline: 'Chofer repartidor · Licencia profesional categoría B',
    contact: 'Luque · WhatsApp 09XX XXX XXX',
    sections: [
      {
        title: 'Perfil',
        text: 'Chofer con 5 años de experiencia en reparto urbano en Gran Asunción. Conozco bien Luque, Asunción y San Lorenzo. Responsable con la mercadería y los cobros.',
      },
      {
        title: 'Experiencia',
        entries: [
          {
            left: 'Chofer repartidor — [Empresa de bebidas], Luque',
            right: '2021 – Actualidad',
            bullets: ['Reparto a comercios con camión liviano, 25 a 40 entregas por día.', 'Cobro contra entrega y rendición diaria.'],
          },
          { left: 'Delivery en moto — [Comercio], Asunción', right: '2019 – 2021' },
        ],
      },
      { title: 'Documentos al día', text: 'Licencia de conducir profesional · Certificado de antecedentes policiales · Cédula de identidad' },
      { title: 'Estudios', text: 'Bachillerato concluido — [Colegio], Luque (2018)' },
      { title: 'Referencias', text: '[Nombre], encargado de logística en [Empresa] — 09XX XXX XXX' },
    ],
  },
};
