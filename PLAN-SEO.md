# PLAN-SEO.md — programmatic SEO build (2026-09-27, updated 2026-09-28)

Status: **in progress.** §0 records what shipped. §2 lists what is left, in
order, and §4 has one copy-paste prompt per remaining PR. Each PR is small
enough for one Claude Code session.

Keyword data lives in `docs/seo/`:
- the full 24.916-phrase export in `docs/seo/trabajo-2026-09-27/`
  (`summary.md`, `clusters.md`);
- the keyword → page map in `KEYWORDS.md` and `keywords-2026-09-27.csv`;
- the Keyword Library tool in `docs/seo/keyword-library/`.

PLAN-GROWTH.md §17 records the head-term titles (homepage, cities,
`/empleos`), `/buscar-personal` and `/publicar-gratis`.

## 0. Shipped (2026-09-28, branch `claude/relaxed-hopper-i5ehtm`)

Rule used throughout: **one meaning group = one page or one H2 section**;
close variants (cv / curriculum vitae / currículum) share a page.

### Existing pages

| Page | Change |
|---|---|
| `/trabajo-en/[ciudad]` | Title and H1 keep the §17 "Bolsa de trabajo en {ciudad}" shape, plus the **CDE** alias for Ciudad del Este (`cityDisplayName()` in `lib/seo/city-copy.ts`; "trabajo cde" is 1.670/mo). New editorial block "Cómo buscar trabajo en {ciudad}". |
| `/trabajo/[categoria]` | The role names people search go in the title (`titleRoles`) and a "Puestos más buscados" section (`roles`), both in `lib/seo/category-copy.ts`: auxiliar administrativo, cajeras, chofer, recepcionista, enfermería, … |
| `/empresas/[slug]` | Title `{Empresa}: trabaja con nosotros — empleos` while the company has live jobs (first half of S1). |
| `/empleos` | H1 `Ofertas de trabajo en Paraguay`. A "Explorá por tipo de trabajo" link row. |
| `/`, `/publicar`, job pages | A "Recursos para tu búsqueda" / "Recursos para empleadores" / "Prepará tu postulación" block linking the guides. |
| Header and footer | Header link **Curriculum**. Footer column **Recursos** (type-of-work landings and guides) and contrato/preaviso in the employer column. |

### New pages

All guides are registered in `lib/guides.ts` (footer, homepage, sitemap and
each page's "Seguí leyendo" read it) and share `components/guide/GuidePage.tsx`
(breadcrumb, table of contents, visible FAQ, Article + FAQPage +
BreadcrumbList JSON-LD). Every labour-law figure lives once in
`lib/labor-law.ts`.

| URL | Serves (searches/mo, approx.) | Notes |
|---|---|---|
| `/calculadora-de-aguinaldo` | 17 aguinaldo groups (≈26.000) | Calculator (fixed salary or month by month) and a proportional table; searches peak Nov–Dec |
| `/salario-minimo` | salario mínimo 2026, jornal, horas extras (≈8.600) | Decreto 6225/2026: Gs. 3.044.000 from 1 July 2026 |
| `/preaviso-e-indemnizacion` | preaviso, despido, indemnización (≈2.300) | Calculator (arts. 87 and 91) |
| `/contrato-de-trabajo` | modelo de contrato de trabajo (≈1.500) | Word model; aimed at employers |
| `/curriculum-vitae` | curriculum vitae, cómo hacer, ejemplos, modelo, formato, básico (≈45.000) | Paraguay specifics: foto, C.I., referencias, "carpeta" |
| `/curriculum-vitae/plantillas` | gratis, plantilla, word, pdf para llenar (≈15.000) | Downloads in `public/descargas/`; generators in `scripts/cv-templates/` |
| `/curriculum-vitae/sin-experiencia` | CV sin experiencia, primer trabajo (≈5.000) | |
| `/carta-de-presentacion` | 9 groups incl. motivación (≈8.000) | |
| `/entrevista-de-trabajo` | preguntas, inglés, fortalezas y debilidades (≈5.800) | |
| `/trabajo-remoto`, `/trabajo-sin-experiencia`, `/trabajo-medio-tiempo` | S3's three landings with demand (≈14.000) | `lib/seo/intent-landings.ts`. `jobTypeRobots()` makes them indexable from 3 live jobs. The matching single `/empleos?modalidad|nivel|tipo=` filter canonicalises to the landing. `seo:verify` asserts both. |

URL decisions: the pages use the exact search phrases (`/curriculum-vitae`,
`/calculadora-de-aguinaldo`). §2 used to plan `/curriculum` and
`/calculadoras/…`; the remaining PRs build under the shipped URLs.

**Owner decision (2026-09-28).** The labour guides — aguinaldo, salario
mínimo, preaviso/indemnización, contrato — ship without the lawyer review
that PLAN-GROWTH.md §7 D14 requires for blog drafts. Each rule cites its
article of the Código del Trabajo, and each page names its sources and
carries the "informativa" line. D14 still governs the `derechos-laborales`
blog drafts.

The blog drafts folded into these pages must not be published as posts
(`content/blog-drafts/README.md` lists them).

## 1. Rules every PR inherits

These are AGENTS.md non-negotiables restated for this work. Nothing in this
plan relaxes any of them:

- **Job reads go through `lib/data.ts`**, and public reads through the single
  visibility predicate in `lib/db/queries.ts`. A landing page that queries the
  DB directly is one forgotten WHERE clause from listing a pending job.
- **Slugs are live SEO URLs.** Every new URL pattern here is permanent from
  its first deploy; choose slugs once, Spanish, lowercase, no accents.
- **No thin pages in the index.** Every programmatic page type has an explicit
  indexing rule in `lib/seo.ts` (same pattern as `companyRobots()` and the
  city landings): `noindex, follow` below a minimum number of live jobs, and
  the sitemap lists only indexable pages. `npm run seo:verify` asserts each
  rule, the same way it already does for companies.
- **No search, ranking or matching of candidates** — everything here is about
  jobs and public labour information, never people.
- **Copy is Spanish (Paraguay); no claims of candidate volume or speed**
  (PLAN-GROWTH.md §7 D1).
- **CI budget:** no new workflow; new checks are steps in the existing
  job. Run `npm run build` + the touched `*:verify` scripts locally before
  pushing.

Structured data already in place (keep it, extend it, never duplicate it):
`JobPosting` (complete: datePosted, validThrough, baseSalary, employmentType,
hiringOrganization, jobLocation, TELECOMMUTE, identifier, directApply),
`BreadcrumbList` and `ItemList` on every landing, `Organization` + `WebSite`
with `SearchAction` on `/`, `BlogPosting` on articles. New page types add
`BreadcrumbList` + `ItemList` in the same way.

## 2. What is left, in order

| # | PR | Model | Status | Why this order |
|---|---|---|---|---|
| S8b | Free **CV builder** at `/curriculum-vitae/crear` | Opus | todo | The largest demand in the data (≈50k/mo). The hub, templates and examples already exist to link it. |
| S4 | Job-title landings `/empleos-de/[puesto]` | Opus | todo | ≈20k/mo: cajera, chofer, auxiliar administrativo, recepcionista, guardia de seguridad, … |
| S2 | More cities | Sonnet | todo | Cheap. Every new city picks up the existing landing. |
| S1 | `/empresas` directory + "Trabajá en {empresa}" H1 | Sonnet | half done (title shipped) | "trabaja con nosotros" is 6.600/mo |
| S7 | Schedule field on jobs + landings | Opus | todo | ≈7k/mo: lunes a viernes, nocturno, fin de semana. Needs a migration. |
| S0 | Google Indexing API ping (optional) | Opus | todo | Faster Google for Jobs. Owner creates a service account first. |
| S6b | More calculators: salario neto (IPS), horas extra | Sonnet | todo | Small; reuses `lib/labor-law.ts` |
| S5 | Salary pages `/salarios/[puesto]` | Opus | todo, after S4 | Needs listings with salaries |
| C9 | Publish the remaining blog drafts | owner + Sonnet | todo | Employer articles (aviso, WhatsApp filter, entrevistar), the 5 sector guides, `paginas-para-publicar-empleos-gratis` |
| S3b | More job-type landings: pasantías, temporal, freelance | Sonnet | only if demand | Same component; check the CSV first |

Done: S3 (the three landings with demand), S6 (aguinaldo, salario mínimo
and preaviso/indemnización, under §0's URLs), and the static half of S8 (hub,
templates, examples, sin experiencia, carta, entrevista).

The biggest lever outside code is **job supply** (PLAN-GROWTH.md §11): every
landing above ranks and converts better with more live listings.

Demand by meaning group (monthly searches, from `clusters.md`; totals are
inflated where Keyword Planner reports the same number for close variants,
so read them as a ranking, not as traffic):

| Need | Biggest phrases | PR |
|---|---|---|
| CV: builder, templates, examples, "para llenar", sin experiencia, carta de presentación, entrevista | curriculum vitae / cv (12.100 — one Google group), modelo de curriculum vitae (1.000), cv ejemplo (1.600), curriculum vitae gratis (880), como hacer un curriculum (720), carta de presentación (320) | S8 (done) + S8b |
| Aguinaldo, salario mínimo, jornal, preaviso, despido, horas extras | salario minimo paraguay 2026 (6.600), calculo de aguinaldo (2.900), como se calcula el aguinaldo (2.400), jornal minimo (1.300), preaviso paraguay (1.300), horas extras (480), aguinaldo proporcional (390), despido injustificado (320) | S6 (done) + S6b |
| Head terms | empleo en py (14.800), bolsa de trabajo de paraguay (8.100), empleos paraguay (5.400) | done (PLAN-GROWTH §17) |
| Company careers | trabaja con nosotros (6.600), Biggie 590, Itaú 320, Continental/Stock/Tigo 260 | S1 |
| Remote / online | trabajo(s) remoto(s) paraguay (1.300 each), trabajos remotos (880) | S3 (done) |
| Job titles | cajeras (2.900), auxiliar/asistente administrativo (590/320), guardias de seguridad (320), recepcionista, chofer | S4 |
| Cities | Asunción 7.900, San Lorenzo 1.580, Luque 1.510, Encarnación 1.400, CDE 1.110 | S2 (+ existing landings) |
| Schedule | busco trabajo de lunes a viernes en paraguay (1.300), nocturno, fin de semana | S7 |

Not ours: "ministerio de justicia y trabajo" (1.600, navigational),
"computrabajo" / "clasipar empleos …" (competitor brands — ads only, never
page copy).

"Keyword gate" means: before the session starts, the owner has merged that
block's Keyword Planner results into `docs/seo/keywords-2026-09-27.csv`
(`python3 docs/seo/kwp-merge.py <export.csv>`), and the session picks its
page list and title wording from the CSV — **not** from guesses. A candidate
page with no search demand is not built.

### S8b — CV builder (`/curriculum-vitae/crear`)

- A form and 3–4 clean templates. "Descargar PDF" uses the browser's
  print-to-PDF with a print stylesheet: no PDF library, no server.
- **Nothing is sent to or stored on the server.** A CV is personal data (Ley
  7593/2025). The draft stays in localStorage with a "Borrar" button. Saving
  it to a candidate account is a later decision that goes through the
  existing consent model (PLAN-PHASE2.md), not this PR.
- Reuse the sections and wording of `lib/cv-examples.ts` and the templates in
  `scripts/cv-templates/`. Link it from `/curriculum-vitae`,
  `/curriculum-vitae/plantillas` and the header, and add it to `lib/guides.ts`.
- Every step ends in the job search ("Ya tenés tu CV — mirá los empleos").

### S7 — Schedule field ("de lunes a viernes")

"busco trabajo de lunes a viernes en paraguay" alone is 1.300/mo, and the
schedule theme totals 3.230/mo — but a job has no schedule today, so no page
can answer it honestly.

- Schema: `jobs.schedule` — a nullable `mysqlEnum` (`lunes_a_viernes`,
  `lunes_a_sabado`, `fines_de_semana`, `nocturno`, `rotativo`), a Drizzle
  migration, no foreign key. Nullable because every existing job predates it.
- Every write path sets it: admin `JobForm`, the employer dashboard form, and
  the `/publicar` form (optional field). Validation in the shared Zod schema.
- Display on the job page and card; `JobPosting` gets `workHours` as text.
- `/empleos` filter `horario=…`; a landing `/trabajo-de-lunes-a-viernes`
  (and `/trabajo-nocturno`, `/trabajo-fin-de-semana` if demand holds) with the
  same indexing rule as S3.
- `db:parity` / seed JSON updated; `seo:verify` covers the new landing rule.

### S0 — Google Indexing API (optional)

- Google's Indexing API is **free** (no per-call price); the default quota is
  200 publish notifications per day per Google Cloud project, and more can be
  requested. It is officially supported only for pages with `JobPosting` (and
  livestream video) markup, which is exactly our case.
- Owner setup: a Google Cloud project, the Indexing API enabled, a service
  account, and that account added as an **Owner** of the Search Console
  property. Its JSON key goes into hPanel as one env var
  (`GOOGLE_INDEXING_SA_JSON`), never into the repo.
- Code: `lib/indexing.ts` (`server-only`) sends `URL_UPDATED` when a job
  becomes publicly visible (the admin approval transition, a renewal) and
  `URL_DELETED` when it leaves (expiry, archive, delete). It signs the
  service-account JWT with `node:crypto` (no new dependency), runs in
  `after()` so it never blocks or fails an admin write, and no-ops when the env
  var is unset (same degrade rule as the other integrations). Expiry has no write to
  hook, so `scripts/listing-confirm.ts` (already a scheduled chore) sends
  `URL_DELETED` for jobs that expired since its last run.
- Verify: `scripts/verify-indexing.ts` — unset env means no call; only
  `/empleos/[slug]` URLs are ever sent; a job is sent `URL_UPDATED` only after
  it passes the visibility predicate.

### S1 — Company pages as "trabajá con nosotros" + `/empresas` directory

- `/empresas/[slug]`: the title already reads `{Empresa}: trabaja con nosotros —
  empleos` while the company has live jobs (§0). Remaining: H1 `Trabajá en
  {empresa}` and a description naming the live job count. Robots
  rule unchanged (`companyRobots()`: indexable only with live jobs).
- New `/empresas`: "Empresas que están contratando en Paraguay" — companies
  with at least one live job, most jobs first, logo + name + count. Reads
  through `lib/data.ts` (`companiesWithPublicJobs()` already exists for the
  sitemap). Targets "empresas que necesiten personal para trabajar" (50/mo)
  and gives every company page a crawl path. `noindex` when fewer than 5
  companies qualify.
- Link `/empresas` from the footer and from `/empleos`.

### S2 — More cities

- Add the cities the 2026-09-27 export shows demand for: Caaguazú (330/mo),
  Mariano Roque Alonso (280), Ñemby (240), Caacupé (220), Coronel Oviedo
  (210), Pedro Juan Caballero (180), Limpio (120), Itauguá (120), Villarrica
  (80) to `lib/seed/cities.json`
  **and** the `cities` table through an idempotent upsert script (the pattern
  of `scripts/migrate-capiata-slug.ts`), with a `CITY_COPY` paragraph each.
- Nothing else changes: `/trabajo-en/[ciudad]` already renders any city, is
  `noindex` at 0 jobs, and the sitemap already filters. The admin `JobForm`
  city select picks the new rows up automatically.
- `npm run db:parity` must still pass (seed and DB agree).

### S3b — More job-type landings (only with demand)

- Add `pasantias` (tipo=pasantia), `temporal` (tipo=temporal) and
  `freelance` (tipo=freelance) to `lib/seo/intent-landings.ts`, only where
  `docs/seo/keywords-2026-09-27.csv` shows demand. The component, the
  `jobTypeRobots()` rule, the canonical rule and the sitemap pick them up.
  Extend the `seo:verify` loop over the landings.

### S4 — Job-title landings `/empleos-de/[puesto]`

- A **curated** dictionary, not free-text generation: `lib/seo/job-titles.ts`
  with 20–40 entries from block 4, each `{ slug, name, plural, match:
  string[] (lower-case title fragments, accent-insensitive), categorySlug?,
  intro }`. Example: `vendedor` matches "vendedor", "vendedora", "ejecutivo
  de ventas", "asesor comercial".
- Query: a new `lib/data.ts` function (seed and DB implementations) that
  returns live jobs whose normalized title contains any `match` fragment,
  through the visibility predicate. At this catalogue size a LIKE scan is
  fine; note in the PR when it stops being fine.
- Robots: index at ≥ 3 live jobs; below that the page still renders (with
  "no hay avisos ahora" + the category and similar titles) but is `noindex`
  and absent from the sitemap.
- Title `Empleos de {puesto} en Paraguay`; H1 `Trabajo de {puesto}`. Links:
  from job detail pages whose title matches an entry ("Más empleos de
  {puesto}"), and from the category landing.
- A `seo:verify` assertion that every dictionary slug is unique, ASCII, and
  never collides with an existing route.

### S5 — Salary pages `/salarios/[puesto]`

- One page per S4 dictionary entry: "¿Cuánto gana un {puesto} en Paraguay?"
- Data: min/max/median of `salary_min`/`salary_max` over jobs that **were
  approved** (published now, or archived/expired after being published),
  excluding `salary_hidden = true`, last 12 months. Never pending, draft or
  rejected jobs. This is the one read that deliberately includes expired jobs,
  so it gets its own named predicate next to the visibility predicate in
  `lib/db/queries.ts`, with a comment and a `seo:verify` assertion that it
  still excludes every unapproved status.
- Honesty rules: minimum sample of 5 listings, else the page says there is
  not enough data yet and is `noindex`. Always print the sample size, the
  period and "según los avisos publicados en trabajo.com.py" — never present
  it as a national statistic. The current minimum wage comes from one constant
  in `lib/labor-law.ts` (shared with S6) with its source and date.
- Links: each salary page ↔ its `/empleos-de/[puesto]` page.

### S6b — More calculators

- `/calculadora-de-salario-neto` (IPS 9 % worker share, the employer's 16,5 %,
  net pay) and a horas extra calculator (daytime +50 %, night +100 %, art.
  234). Add them to `lib/guides.ts`, with figures only from `lib/labor-law.ts`.
- `scripts/verify-labor.ts`: worked examples (known input → known output) for
  every function in `lib/labor-law.ts`, as a step in the existing CI job.

### C9 — Blog drafts

- Owner: publish through `/admin/blog` the drafts that are **not** folded
  into guides: `como-escribir-un-aviso-de-empleo`,
  `como-filtrar-postulantes-por-whatsapp`, `como-entrevistar-candidatos`,
  `errores-al-publicar-un-empleo`, the five `como-conseguir-trabajo-en-*`
  guides, `perfil-profesional-en-el-cv`, `como-hablar-de-salario-en-una-entrevista`,
  `entrevista-por-videollamada-o-whatsapp`, `trabajar-en-ciudad-del-este`,
  `paginas-para-publicar-empleos-gratis-en-paraguay`. Clear any `[VERIFICAR]`
  marker first.
- Owner: the published post `/blog/como-escribir-un-cv-en-paraguay` competes
  with `/curriculum-vitae`. Either add a first line linking to it, or
  unpublish it and add a 301 to `/curriculum-vitae`.

## 3. What the owner does

1. **Database:** run `npm run db:migrate` against production before or with
   the next deploy (it applies only the missing migrations and is safe to
   re-run), then `npm run db:verify`. Nothing in §0 needs a migration; `main`
   carries `0015`–`0021`.
2. **Every July:** update `SALARIO_MINIMO` in `lib/labor-law.ts` (amount,
   jornal, previous amount, decree, source). Then bump `updated` for
   `salarioMinimo` and `aguinaldo` in `lib/guides.ts`.
3. **Search Console:** after each deploy, resubmit `/sitemap.xml` and request
   indexing of new page types. Start with `/calculadora-de-aguinaldo` before
   November.
4. **Keyword gate:** before S2, S3b, S4 or S5, merge that block's Keyword
   Planner results (`python3 docs/seo/kwp-merge.py <export.csv>`) and commit
   the CSV.
5. **S0 only:** create the Google Cloud project and service account, add it
   as an owner in Search Console, and put the JSON in hPanel.
6. C9 (above).

## 4. Session prompts

Paste one as the first message of a fresh Claude Code session on this repo.
Use the model named in §2; never Fable for these sessions.

**S8b (Opus)**
> Read AGENTS.md and PLAN-SEO.md §0, §1 and §2 S8b. Build the in-browser CV
> builder at `/curriculum-vitae/crear`: form, 3–4 templates, PDF through a
> print stylesheet, draft in localStorage with a "Borrar" button, **no server
> storage and no network call with CV data**. Reuse `lib/cv-examples.ts` and
> the guide components, register it in `lib/guides.ts`, and link it from the
> CV hub, the templates page and the header. Verify locally (lint, typecheck,
> build, seo:verify); one PR.

**S1 (Sonnet)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S1. Implement S1 exactly: retitle
> `/empresas/[slug]` to "Empleos en {empresa} — trabajá con nosotros", add the
> `/empresas` directory of companies with live jobs (through `lib/data.ts`,
> with an indexing rule in `lib/seo.ts` asserted by `seo:verify`), link it from
> the footer and `/empleos`, add it to the sitemap. Check
> `docs/seo/keywords-2026-09-27.csv` for company-careers phrases and use the
> wording with demand. Run lint, typecheck, build and every verify script
> locally before pushing; one PR.

**S2 (Sonnet)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S2. Pick the cities with search
> demand from `docs/seo/keywords-2026-09-27.csv` ("trabajo en X", "bolsa de
> trabajo X"), add them to `lib/seed/cities.json` and to the database through an
> idempotent upsert script, write one `CITY_COPY` paragraph each (factual,
> no invented statistics). Confirm `/trabajo-en/[ciudad]` is noindex at 0
> jobs and the sitemap filters them. Run `db:parity` if a database is available,
> plus lint, typecheck, build and the verify scripts; one PR.

**S4 (Opus)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S4. Build `/empleos-de/[puesto]`
> from a curated dictionary in `lib/seo/job-titles.ts` (20–40 entries chosen
> from `docs/seo/keywords-2026-09-27.csv`), a new `lib/data.ts` read with seed
> and DB implementations that goes through the visibility predicate, an
> indexing rule (≥ 3 live jobs), sitemap entries only when indexable, links
> from matching job detail pages and category landings, and `seo:verify`
> assertions for the dictionary. Verify locally, including `db:test` if a
> database is available; one PR.

**S5 (Opus)** — after S4 is merged
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S5. Build `/salarios/[puesto]` over
> the S4 dictionary. Design the "was approved" salary predicate next to the
> visibility predicate in `lib/db/queries.ts`, never including pending, draft
> or rejected jobs, and assert that in `seo:verify`. Apply the honesty rules
> exactly: sample ≥ 5 or noindex with a "not enough data" message, and always show
> sample size, period and source. The minimum wage comes from `lib/labor-law.ts`. Verify
> locally; one PR.

**S7 (Opus)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S7. Add the nullable
> `jobs.schedule` enum with a Drizzle migration (no FK), set it from every job
> write path (admin JobForm, employer dashboard form, the optional field on
> /publicar via the shared Zod schema), show it on the job page, card and
> JobPosting `workHours`, add the `horario` filter to /empleos and the
> `/trabajo-de-lunes-a-viernes` landing with the S3 indexing rule. Keep seed
> and DB in parity. Verify locally, including `db:test` if a database is
> available; one PR.

**S0 (Opus)** — after the owner has set `GOOGLE_INDEXING_SA_JSON`
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S0. Implement the Indexing API
> notifications exactly as specified: `server-only`, JWT signed with
> `node:crypto`, run in `after()`, no-op when the env var is unset, only
> `/empleos/[slug]` URLs, `URL_DELETED` for expiries from the listing-confirm
> chore, and `scripts/verify-indexing.ts` wired into the existing CI job.
> Document the env var in `.env.example` and README. Verify locally; one PR.

**S3b (Sonnet)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S3b. Check
> `docs/seo/keywords-2026-09-27.csv` for pasantías / trabajo temporal /
> freelance demand, and add only those with demand to
> `lib/seo/intent-landings.ts` as new routes using `components/IntentLanding.tsx`,
> with editorial copy. Extend `scripts/verify-seo.ts`'s landing loop. Verify
> locally; one PR.

**S6b (Sonnet)**
> Read AGENTS.md and PLAN-SEO.md §0, §1 and §2 S6b. Build the salario neto
> (IPS) and horas extra calculators as guides (`lib/guides.ts`,
> `components/guide/GuidePage.tsx`), every figure from `lib/labor-law.ts`, pure
> client-side functions, plus `scripts/verify-labor.ts` with worked examples,
> wired as a step in the existing CI job. Verify locally; one PR.

