/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS generator, run outside the app (README.md) */
// Renders the PDF versions of the CV templates with Chromium.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const CSS = `
@page { size: A4; margin: 16mm 17mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1E1B17; font-size: 10pt; line-height: 1.4; margin: 0; }
.head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
h1 { font-size: 20pt; margin: 0 0 2px; }
.sub { color: #C0362A; font-size: 11.5pt; margin: 0 0 6px; }
.contact { color: #57514A; font-size: 9.5pt; margin: 0 0 2px; }
.photo { width: 30mm; height: 38mm; border: 1px dashed #B8B0A2; color: #8A8378; font-size: 8pt; display: flex; align-items: center; justify-content: center; text-align: center; flex: none; }
h2 { font-size: 10.5pt; color: #C0362A; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #D8D0C2; padding-bottom: 2px; margin: 14px 0 6px; }
.row { display: flex; justify-content: space-between; gap: 12px; font-weight: bold; margin-top: 4px; }
.row span:last-child { font-weight: normal; color: #57514A; white-space: nowrap; }
ul { margin: 2px 0 6px; padding-left: 16px; }
li { margin: 1px 0; }
p { margin: 2px 0 4px; }
.line { border-bottom: 1px solid #B8B0A2; color: #57514A; padding: 12px 0 3px; }
.blank { border-bottom: 1px solid #B8B0A2; height: 24px; }
.foot { margin-top: 14px; color: #8A8378; font-size: 7.5pt; text-align: right; }
`;

const FOOT = '<p class="foot">Plantilla gratuita de trabajo.com.py</p>';

function page(body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}${FOOT}</body></html>`;
}
const row = (l, r) => `<div class="row"><span>${l}</span><span>${r}</span></div>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const basico = page(`
<div class="head"><div>
<h1>[Nombre y Apellido]</h1>
<p class="sub">[Puesto al que te postulás]</p>
<p class="contact">[Barrio], [Ciudad] · WhatsApp: [09XX XXX XXX] · [nombre.apellido@correo.com]</p>
<p class="contact">C.I. N.º [X.XXX.XXX] · Fecha de nacimiento: [dd/mm/aaaa] (datos opcionales)</p>
</div><div class="photo">Foto tipo carnet<br>(opcional)</div></div>
<h2>Perfil</h2>
<p>[Dos o tres líneas: qué sabés hacer, en qué rubro tenés experiencia y qué puesto buscás. Ejemplo: Auxiliar administrativa con 3 años de experiencia en facturación y atención a proveedores. Manejo de Excel y sistemas de gestión. Busco sumarme al área administrativa de una empresa en Asunción.]</p>
<h2>Experiencia laboral</h2>
${row('[Cargo] — [Empresa], [Ciudad]', '[mes/año] – [mes/año o Actualidad]')}
${ul(['[Tarea o logro concreto: qué hacías y con qué resultado]', '[Otra tarea: sistemas, herramientas o responsabilidades]'])}
${row('[Cargo] — [Empresa], [Ciudad]', '[mes/año] – [mes/año]')}
${ul(['[Tarea o logro concreto]', '[Otra tarea]'])}
<h2>Formación académica</h2>
${row('[Carrera o título] — [Universidad o instituto]', '[año o "En curso"]')}
${row('[Bachillerato en …] — [Colegio], [Ciudad]', '[año]')}
<h2>Cursos y capacitaciones</h2>
${ul(['[Nombre del curso] — [Institución] ([año])', '[Nombre del curso] — [Institución] ([año])'])}
<h2>Habilidades</h2>
${ul(['[Herramientas: Excel, sistemas de facturación, caja, redes sociales…]', '[Otras: licencia de conducir categoría …, manejo de montacargas…]'])}
<h2>Idiomas</h2>
<p>Castellano: nativo · Guaraní: [nivel] · [Portugués / Inglés]: [nivel]</p>
<h2>Referencias</h2>
${ul(['[Nombre y Apellido] — [Cargo], [Empresa] — Tel.: [09XX XXX XXX]', '[Nombre y Apellido] — [Cargo], [Empresa] — Tel.: [09XX XXX XXX]'])}
`);

const sinExp = page(`
<div class="head"><div>
<h1>María González</h1>
<p class="sub">Atención al cliente · Ventas · Caja</p>
<p class="contact">San Lorenzo, Central · WhatsApp: 09XX XXX XXX · maria.gonzalez@correo.com</p>
</div><div class="photo">Foto tipo carnet<br>(opcional)</div></div>
<h2>Perfil</h2>
<p>Estudiante de Administración de Empresas. Busco mi primer empleo en atención al cliente, caja o ventas. Tengo experiencia atendiendo público y manejando caja en el negocio familiar, y disponibilidad de lunes a sábado.</p>
<h2>Formación</h2>
${row('Administración de Empresas (2.º año, turno noche) — [Universidad]', 'En curso')}
${row('Bachillerato Técnico en Contabilidad — [Colegio], San Lorenzo', '2024')}
<h2>Experiencia práctica</h2>
${row('Despensa familiar — atención al cliente y caja', '2022 – Actualidad')}
${ul(['Atención de clientes, cobro en efectivo y por transferencia, cierre de caja diario.', 'Reposición de mercadería y control de vencimientos.'])}
${row('Venta de ropa por Instagram — emprendimiento propio', '2023 – 2024')}
${ul(['Publicaciones, respuesta de consultas por WhatsApp y coordinación de entregas.'])}
<h2>Cursos</h2>
${ul(['Excel básico e intermedio — [Institución] (2025)', 'Atención al cliente — [Institución o curso en línea] (2024)'])}
<h2>Habilidades</h2>
<p>Manejo de caja y medios de pago · Excel (tablas, sumas, filtros) · Atención presencial y por WhatsApp · Redacción clara</p>
<h2>Idiomas</h2>
<p>Castellano: nativo · Guaraní: fluido · Inglés: básico</p>
<h2>Disponibilidad</h2>
<p>Lunes a sábado, de mañana y tarde. Zona Gran Asunción.</p>
<h2>Referencias</h2>
${ul(['[Nombre y Apellido] — Profesor/a de [materia], [Colegio] — Tel.: 09XX XXX XXX', '[Nombre y Apellido] — Cliente frecuente / vecino/a — Tel.: 09XX XXX XXX'])}
`);

const line = (l) => `<div class="line">${l}</div>`;
const blank = '<div class="blank"></div>';
const paraLlenar = page(`
<div class="head"><div>
<h1>CURRICULUM VITAE</h1>
<p class="sub">Completá a mano con letra clara</p>
</div><div class="photo">Foto tipo carnet<br>(opcional)</div></div>
<h2>Datos personales</h2>
${line('Nombre y apellido:')}
${line('C.I. N.º: <span style="margin-left:40%">Fecha de nacimiento:</span>')}
${line('Nacionalidad: <span style="margin-left:36%">Estado civil:</span>')}
${line('Dirección (barrio y ciudad):')}
${line('Teléfono / WhatsApp: <span style="margin-left:26%">Correo electrónico:</span>')}
<h2>Perfil / objetivo</h2>
${blank}${blank}
<h2>Experiencia laboral (la más reciente primero)</h2>
${line('Empresa: <span style="margin-left:44%">Cargo:</span>')}
${line('Desde: <span style="margin-left:18%">Hasta:</span><span style="margin-left:18%">Tareas:</span>')}
${blank}
${line('Empresa: <span style="margin-left:44%">Cargo:</span>')}
${line('Desde: <span style="margin-left:18%">Hasta:</span><span style="margin-left:18%">Tareas:</span>')}
${blank}
<h2>Formación</h2>
${line('Estudios secundarios (colegio y año):')}
${line('Estudios terciarios / universitarios:')}
${line('Cursos y capacitaciones:')}
<h2>Habilidades e idiomas</h2>
${line('Habilidades (sistemas, herramientas, licencia de conducir):')}
${line('Idiomas (castellano, guaraní, otros):')}
<h2>Referencias</h2>
${line('Nombre, relación y teléfono:')}
${line('Nombre, relación y teléfono:')}
`);

(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pg = await browser.newPage();
  for (const [name, html] of [
    ['plantilla-curriculum-vitae-basico', basico],
    ['plantilla-cv-sin-experiencia', sinExp],
    ['curriculum-vitae-para-llenar', paraLlenar],
  ]) {
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.pdf({ path: `${out}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await pg.setViewportSize({ width: 794, height: 1123 });
    await pg.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    console.log('wrote', name);
  }
  await browser.close();
})();
