/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS generator, run outside the app (README.md) */
// Generates the downloadable CV templates for /curriculum-vitae/plantillas.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType, LevelFormat, VerticalAlign, TabStopType,
} = require('docx');

const INK = '1E1B17';
const MUTED = '57514A';
const ACCENT = 'C0362A';
const FONT = 'Arial';
const PAGE_W = 11906; // A4
const MARGIN = 1000;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? 20, bold: opts.bold, italics: opts.italics, color: opts.color ?? INK });
}

function p(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [run(children, opts)],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60 },
    alignment: opts.align,
    numbering: opts.bullet ? { reference: 'bullets', level: 0 } : undefined,
    tabStops: opts.tabRight ? [{ type: TabStopType.RIGHT, position: CONTENT_W }] : undefined,
  });
}

function section(title) {
  return new Paragraph({
    children: [run(title.toUpperCase(), { bold: true, size: 21, color: ACCENT })],
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D8D0C2', space: 2 } },
  });
}

function entry(left, right, detailLines) {
  return [
    p([run(left, { bold: true }), run('\t'), run(right, { color: MUTED })], { tabRight: true, after: 20 }),
    ...detailLines.map((d) => p(d, { bullet: true, after: 20 })),
    p('', { after: 60 }),
  ];
}

function header(name, subtitle, contactLines, withPhoto) {
  const left = [
    p([run(name, { bold: true, size: 36 })], { after: 40 }),
    p([run(subtitle, { size: 22, color: ACCENT })], { after: 80 }),
    ...contactLines.map((l) => p([run(l, { size: 19, color: MUTED })], { after: 20 })),
  ];
  if (!withPhoto) return left;
  const photoW = 1700;
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W - photoW, photoW],
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: CONTENT_W - photoW, type: WidthType.DXA }, borders: noBorders, children: left }),
            new TableCell({
              width: { size: photoW, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                top: { style: BorderStyle.DASHED, size: 4, color: 'B8B0A2' },
                bottom: { style: BorderStyle.DASHED, size: 4, color: 'B8B0A2' },
                left: { style: BorderStyle.DASHED, size: 4, color: 'B8B0A2' },
                right: { style: BorderStyle.DASHED, size: 4, color: 'B8B0A2' },
              },
              children: [
                p([run('Foto tipo carnet', { size: 16, color: MUTED })], { align: AlignmentType.CENTER, before: 500, after: 0 }),
                p([run('(opcional)', { size: 16, color: MUTED })], { align: AlignmentType.CENTER, after: 500 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function doc(children) {
  return new Document({
    creator: 'trabajo.com.py',
    title: 'Curriculum vitae',
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 900, bottom: 900, left: MARGIN, right: MARGIN } } },
      children,
    }],
  });
}

// ---------------------------------------------------------------------------
// 1. Básico (cronológico)
// ---------------------------------------------------------------------------
const basico = doc([
  ...header('[Nombre y Apellido]', '[Puesto al que te postulás]', [
    '[Barrio], [Ciudad] · WhatsApp: [09XX XXX XXX] · [nombre.apellido@correo.com]',
    'C.I. N.º [X.XXX.XXX] · Fecha de nacimiento: [dd/mm/aaaa] (datos opcionales)',
  ], true),
  section('Perfil'),
  p('[Dos o tres líneas: qué sabés hacer, en qué rubro tenés experiencia y qué puesto buscás. Ejemplo: Auxiliar administrativa con 3 años de experiencia en facturación y atención a proveedores. Manejo de Excel y sistemas de gestión. Busco sumarme al área administrativa de una empresa en Asunción.]'),
  section('Experiencia laboral'),
  ...entry('[Cargo] — [Empresa], [Ciudad]', '[mes/año] – [mes/año o Actualidad]', [
    '[Tarea o logro concreto: qué hacías y con qué resultado]',
    '[Otra tarea: sistemas, herramientas o responsabilidades]',
  ]),
  ...entry('[Cargo] — [Empresa], [Ciudad]', '[mes/año] – [mes/año]', [
    '[Tarea o logro concreto]',
    '[Otra tarea]',
  ]),
  section('Formación académica'),
  ...entry('[Carrera o título] — [Universidad o instituto]', '[año o "En curso"]', []),
  ...entry('[Bachillerato en …] — [Colegio], [Ciudad]', '[año]', []),
  section('Cursos y capacitaciones'),
  p('[Nombre del curso] — [Institución] ([año])', { bullet: true }),
  p('[Nombre del curso] — [Institución] ([año])', { bullet: true }),
  section('Habilidades'),
  p('[Herramientas: Excel, sistemas de facturación, caja, redes sociales…]', { bullet: true }),
  p('[Otras: licencia de conducir categoría …, manejo de montacargas…]', { bullet: true }),
  section('Idiomas'),
  p('Castellano: nativo · Guaraní: [nivel] · [Portugués / Inglés]: [nivel]'),
  section('Referencias'),
  p('[Nombre y Apellido] — [Cargo], [Empresa] — Tel.: [09XX XXX XXX]', { bullet: true }),
  p('[Nombre y Apellido] — [Cargo], [Empresa] — Tel.: [09XX XXX XXX]', { bullet: true }),
]);

// ---------------------------------------------------------------------------
// 2. Sin experiencia (funcional) — filled example
// ---------------------------------------------------------------------------
const sinExp = doc([
  ...header('María González', 'Atención al cliente · Ventas · Caja', [
    'San Lorenzo, Central · WhatsApp: 09XX XXX XXX · maria.gonzalez@correo.com',
  ], true),
  section('Perfil'),
  p('Estudiante de Administración de Empresas. Busco mi primer empleo en atención al cliente, caja o ventas. Tengo experiencia atendiendo público y manejando caja en el negocio familiar, y disponibilidad de lunes a sábado.'),
  section('Formación'),
  ...entry('Administración de Empresas (2.º año, turno noche) — [Universidad]', 'En curso', []),
  ...entry('Bachillerato Técnico en Contabilidad — [Colegio], San Lorenzo', '2024', []),
  section('Experiencia práctica'),
  ...entry('Despensa familiar — atención al cliente y caja', '2022 – Actualidad', [
    'Atención de clientes, cobro en efectivo y por transferencia, cierre de caja diario.',
    'Reposición de mercadería y control de vencimientos.',
  ]),
  ...entry('Venta de ropa por Instagram — emprendimiento propio', '2023 – 2024', [
    'Publicaciones, respuesta de consultas por WhatsApp y coordinación de entregas.',
  ]),
  section('Cursos'),
  p('Excel básico e intermedio — [Institución] (2025)', { bullet: true }),
  p('Atención al cliente — [Institución o curso en línea] (2024)', { bullet: true }),
  section('Habilidades'),
  p('Manejo de caja y medios de pago · Excel (tablas, sumas, filtros) · Atención presencial y por WhatsApp · Redacción clara'),
  section('Idiomas'),
  p('Castellano: nativo · Guaraní: fluido · Inglés: básico'),
  section('Disponibilidad'),
  p('Lunes a sábado, de mañana y tarde. Zona Gran Asunción.'),
  section('Referencias'),
  p('[Nombre y Apellido] — Profesor/a de [materia], [Colegio] — Tel.: 09XX XXX XXX', { bullet: true }),
  p('[Nombre y Apellido] — Cliente frecuente / vecino/a — Tel.: 09XX XXX XXX', { bullet: true }),
]);

// ---------------------------------------------------------------------------
// 3. Para llenar (printable form)
// ---------------------------------------------------------------------------
function line(label) {
  return new Paragraph({
    children: [run(label, { size: 20, color: MUTED })],
    spacing: { before: 140, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B8B0A2', space: 4 } },
  });
}
function blank() {
  return new Paragraph({
    children: [run(' ')],
    spacing: { before: 200, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B8B0A2', space: 4 } },
  });
}
const paraLlenar = doc([
  ...header('CURRICULUM VITAE', 'Completá a mano con letra clara', [], true),
  section('Datos personales'),
  line('Nombre y apellido:'),
  line('C.I. N.º:                                              Fecha de nacimiento:'),
  line('Nacionalidad:                                       Estado civil:'),
  line('Dirección (barrio y ciudad):'),
  line('Teléfono / WhatsApp:                            Correo electrónico:'),
  section('Perfil / objetivo'),
  blank(), blank(),
  section('Experiencia laboral (la más reciente primero)'),
  line('Empresa:                                                        Cargo:'),
  line('Desde:                     Hasta:                     Tareas:'),
  blank(),
  line('Empresa:                                                        Cargo:'),
  line('Desde:                     Hasta:                     Tareas:'),
  blank(),
  section('Formación'),
  line('Estudios secundarios (colegio y año):'),
  line('Estudios terciarios / universitarios:'),
  line('Cursos y capacitaciones:'),
  section('Habilidades e idiomas'),
  line('Habilidades (sistemas, herramientas, licencia de conducir):'),
  line('Idiomas (castellano, guaraní, otros):'),
  section('Referencias'),
  line('Nombre, relación y teléfono:'),
  line('Nombre, relación y teléfono:'),
]);

// ---------------------------------------------------------------------------
// 4. Modelo de contrato individual de trabajo (/contrato-de-trabajo)
// ---------------------------------------------------------------------------
function clause(n, title, text) {
  return p([run(`${n}. ${title}. `, { bold: true }), run(text)], { after: 120 });
}
const contrato = doc([
  p([run('CONTRATO INDIVIDUAL DE TRABAJO', { bold: true, size: 28 })], { align: AlignmentType.CENTER, after: 240 }),
  p('En la ciudad de [Ciudad], a los [día] días del mes de [mes] de [año], entre [Razón social de la empresa], RUC N.º [XXXXXXX-X], con domicilio en [dirección], representada en este acto por [nombre del representante], en adelante EL EMPLEADOR; y [Nombre y apellido], con C.I. N.º [X.XXX.XXX], de nacionalidad [ ], de [ ] años de edad, domiciliado/a en [dirección], en adelante EL TRABAJADOR, se celebra el presente contrato individual de trabajo, que se regirá por el Código del Trabajo (Ley N.º 213/93) y por las siguientes cláusulas:', { after: 200 }),
  clause('PRIMERA', 'Cargo y tareas', 'EL TRABAJADOR prestará servicios como [cargo], realizando las siguientes tareas: [describir las tareas principales].'),
  clause('SEGUNDA', 'Lugar de trabajo', 'Las tareas se realizarán en [dirección del lugar de trabajo] [o en modalidad de teletrabajo, conforme a la Ley N.º 6738/2021].'),
  clause('TERCERA', 'Duración', 'El presente contrato es por tiempo indefinido [o: por plazo determinado, desde el [fecha] hasta el [fecha] / para la obra o servicio de [describir]] y comienza a regir el [fecha de inicio].'),
  clause('CUARTA', 'Período de prueba', 'Las partes acuerdan un período de prueba de [30 / 60] días, conforme al artículo 58 del Código del Trabajo.'),
  clause('QUINTA', 'Jornada y horario', 'La jornada será de [ ] horas diarias, de [día] a [día], en el horario de [hora] a [hora], dentro de los límites de la jornada legal. Las horas extraordinarias se abonarán con los recargos de ley.'),
  clause('SEXTA', 'Remuneración', 'EL EMPLEADOR abonará a EL TRABAJADOR un salario de Gs. [monto] ([monto en letras]) mensuales, pagaderos [mensual / quincenalmente] mediante [depósito bancario / efectivo], a más tardar el [día] de cada período. El salario no será inferior al mínimo legal vigente.'),
  clause('SÉPTIMA', 'Seguridad social', 'EL EMPLEADOR inscribirá a EL TRABAJADOR en el Instituto de Previsión Social (IPS) desde el inicio de la relación laboral y efectuará los aportes que correspondan.'),
  clause('OCTAVA', 'Aguinaldo y vacaciones', 'EL TRABAJADOR percibirá el aguinaldo y gozará de las vacaciones anuales remuneradas conforme al Código del Trabajo.'),
  clause('NOVENA', 'Obligaciones', 'Ambas partes se obligan a cumplir las disposiciones del Código del Trabajo y, en su caso, el reglamento interno de la empresa, que EL TRABAJADOR declara conocer.'),
  clause('DÉCIMA', 'Terminación', 'La terminación del contrato se regirá por lo dispuesto en el Código del Trabajo en materia de preaviso, indemnización y causas justificadas.'),
  p('En prueba de conformidad, se firman dos ejemplares de un mismo tenor y a un solo efecto, en el lugar y la fecha indicados.', { before: 200, after: 600 }),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W / 2, CONTENT_W / 2],
    borders: noBorders,
    rows: [new TableRow({ children: ['EL EMPLEADOR', 'EL TRABAJADOR'].map((who) => new TableCell({
      width: { size: CONTENT_W / 2, type: WidthType.DXA },
      borders: noBorders,
      children: [
        p('______________________________', { align: AlignmentType.CENTER, after: 40 }),
        p([run(who, { bold: true })], { align: AlignmentType.CENTER, after: 20 }),
        p('Firma y aclaración', { align: AlignmentType.CENTER, color: MUTED }),
      ],
    })) })],
  }),
  p([run('Modelo orientativo de trabajo.com.py. Adaptalo a cada caso y, ante dudas, consultá a un profesional.', { size: 16, color: MUTED, italics: true })], { before: 400 }),
]);

(async () => {
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  for (const [name, d] of [
    ['plantilla-curriculum-vitae-basico', basico],
    ['plantilla-cv-sin-experiencia', sinExp],
    ['curriculum-vitae-para-llenar', paraLlenar],
    ['modelo-contrato-de-trabajo', contrato],
  ]) {
    fs.writeFileSync(`${out}/${name}.docx`, await Packer.toBuffer(d));
    console.log('wrote', name);
  }
})();
