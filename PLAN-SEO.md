# PLAN-SEO.md — keyword-driven SEO program (2026-09-28)

Source: Google Keyword Planner export for Paraguay / Español (27 sep 2026),
24,916 phrases in 161 meaning groups, 260,790 deduplicated searches/month.
Competitor brands (computrabajo, clasipar, linkedin, workana, acciontrabajo,
jobomas, bumeran) are never targeted.

Rule used throughout: **one meaning group = one page or one H2 section**;
close variants (cv / curriculum vitae / currículum) share a page.

## 1. What shipped in this PR

### Quick wins — existing pages (§2 of the plan)

| # | Page | Main keyword added | Change |
|---|---|---|---|
| Q1 | `/` | bolsa de trabajo, empleos en Paraguay | Title `Empleos en Paraguay — bolsa de trabajo \| trabajo.com.py`, new meta, hero subhead, editorial block "La bolsa de trabajo de Paraguay" + "Recursos para tu búsqueda" |
| Q2 | `/empleos` (bare) | ofertas de trabajo, vacancias | Title `Ofertas de trabajo en Paraguay: vacancias laborales hoy`, H1 `Ofertas de trabajo en Paraguay`, meta; "Explorá por tipo de trabajo" links |
| Q3–Q5 | `/trabajo-en/[ciudad]` | bolsa de trabajo {ciudad}; "CDE" | Title `Trabajo en {Ciudad}: bolsa de trabajo y empleos hoy`, CDE alias in title + H1 (`lib/seo/city-copy.ts`), editorial "Cómo buscar trabajo en {Ciudad}" |
| Q6 | `/trabajo/[categoria]` | role names (auxiliar administrativo, cajeras, chofer, recepcionista, enfermería…) | `titleRoles` in title, role-based meta, "Puestos más buscados" section (`lib/seo/category-copy.ts`) |
| Q7 | `/empresas/[slug]` | {empresa} trabaja con nosotros | Title `{Empresa}: trabaja con nosotros — empleos` while the company has public jobs |
| Q8 | `/publicar` | buscar personal | Title + H1 "…y encontrá personal", "Recursos para empleadores" |

Site-wide: header link **Curriculum**, footer column **Recursos** (type-of-work
landings + guides), employer column links contrato/preaviso, and a "Prepará
tu postulación" block on every job page.

### New pages

| URL | Groups served (searches/mo, approx.) | Notes |
|---|---|---|
| `/calculadora-de-aguinaldo` | 17 aguinaldo groups (≈26,000) | Client calculator (fixed or month-by-month); proportional table from the minimum wage; peaks Nov–Dec |
| `/curriculum-vitae` | curriculum vitae, currículum, como hacer un curriculum, ejemplos, modelo, formato, básico, sencillo, cronológico (≈45,000) | Paraguay specifics (foto, C.I., referencias, carpeta de documentos); 2 example CVs as HTML |
| `/curriculum-vitae/plantillas` | gratis, pdf gratis, plantilla, word, para llenar (≈15,000) | Downloads in `public/descargas/` (DOCX + PDF) |
| `/curriculum-vitae/sin-experiencia` | CV sin experiencia, primer trabajo (≈5,000) | From draft `cv-sin-experiencia-paraguay` |
| `/carta-de-presentacion` | 9 groups incl. motivación, sin experiencia, typos (≈8,000) | From draft `carta-de-presentacion-con-ejemplo` |
| `/entrevista-de-trabajo` | preguntas, inglés, 10 consejos, fortalezas y debilidades (≈5,800) | From drafts `preguntas-frecuentes…`, `entrevista-por-videollamada…` |
| `/salario-minimo` | salario mínimo 2026, jornal mínimo, horas extras (≈8,600) | All amounts from `lib/labor-law.ts` |
| `/preaviso-e-indemnizacion` | preaviso, despido injustificado, indemnización (≈2,300) | Calculator (arts. 87, 91) |
| `/contrato-de-trabajo` | contrato de trabajo modelo (≈1,500) | Word model in `public/descargas/`; employer-facing |
| `/trabajo-remoto` | trabajo remoto / online / desde casa (≈5,500) | `?modalidad=remoto` canonicalises here |
| `/trabajo-sin-experiencia` | sin experiencia, jóvenes, primer empleo (≈6,000) | `?nivel=sin_experiencia` canonicalises here |
| `/trabajo-medio-tiempo` | medio tiempo, estudiantes, pasantías (≈2,600) | `?tipo=medio_tiempo` canonicalises here |

Mechanics: guides are registered in `lib/guides.ts` (footer, homepage,
sitemap and "Seguí leyendo" read it); the three landings in
`lib/seo/intent-landings.ts`, with the canonical rule in `lib/seo.ts` and its
assertions in `scripts/verify-seo.ts`. Labour-law figures live once in
`lib/labor-law.ts`.

### Owner decision recorded (2026-09-28)

The owner decided the labour-rights guides (aguinaldo, salario mínimo,
preaviso, contrato) ship **without** the lawyer review that PLAN-GROWTH.md
§7 D14 requires for blog drafts. The pages cite the Código del Trabajo article
for each rule, name their sources, and carry the "informativa" line. D14 still
governs the `derechos-laborales` blog drafts.

## 2. Owner to-dos

1. **Every July:** update `SALARIO_MINIMO` in `lib/labor-law.ts` (amount,
   jornal, previous amount, decree, source) and bump `updated` for
   `salarioMinimo` and `aguinaldo` in `lib/guides.ts`. Every page follows.
2. **Existing blog post `/blog/como-escribir-un-cv-en-paraguay`** targets the
   same query as `/curriculum-vitae`. In `/admin/blog`, add a first line
   linking to `/curriculum-vitae` ("Guía completa con ejemplos y plantillas"),
   or unpublish it and add a 301 to `/curriculum-vitae`.
3. **Do not publish** these drafts as blog posts; their content now lives in
   the guides and a second page would compete with it:
   `cv-sin-experiencia-paraguay`, `carta-de-presentacion-con-ejemplo`,
   `preguntas-frecuentes-en-una-entrevista-de-trabajo`, `aguinaldo-en-paraguay`,
   `salario-minimo-en-paraguay`, `despido-preaviso-e-indemnizacion-en-paraguay`,
   `trabajo-de-medio-tiempo-para-estudiantes`,
   `como-buscar-trabajo-sin-experiencia-en-asuncion`.
4. **Search Console:** resubmit `/sitemap.xml` after deploy and request
   indexing for `/calculadora-de-aguinaldo` first (seasonal peak Nov–Dec).

## 3. Next (not in this PR)

- **Role landings** `/empleos-de/[puesto]` — cajera (≈4,200), chofer (≈4,600),
  auxiliar administrativo (2,650), recepcionista, guardia de seguridad
  (1,520, no matching category today), vendedor, enfermería, limpieza,
  delivery. Through `getJobs({ q })` in `lib/data.ts`, noindex while empty.
- **New cities** with real volume: Caaguazú (310), Caacupé (210), Coronel
  Oviedo (180), Pedro Juan Caballero (180), Ñemby (160). Needs a `cities` row
  per city (seed + DB); landings already noindex while empty.
- **Schedule field on jobs** (lunes a viernes 2,670, fin de semana 1,650,
  nocturno 2,600, por horas) — schema change, then landings.
- **Online CV builder** that exports a PDF and creates a candidate account
  ("crear cv online gratis", "cv para llenar").
- Salary pages by role once the catalogue has enough salary data; a public
  sector / concursos guide (≈800).
