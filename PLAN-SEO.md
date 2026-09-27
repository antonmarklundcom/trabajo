# PLAN-SEO.md — programmatic SEO build (2026-09-27)

Status: **not started.** Eight PRs (plus one optional PR), each small enough for a single Claude Code
session, each with a copy-paste prompt in §4. Keyword data and the
keyword → page map live in `docs/seo/` (`KEYWORDS.md`,
`keywords-2026-09-27.csv`); PLAN-GROWTH.md §17 records what already shipped
(homepage, city and /empleos titles, `/buscar-personal`, `/publicar-gratis`).

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

## 2. The PRs

| # | PR | Model | Depends on | Keyword gate |
|---|---|---|---|---|
| S0 | Google Indexing API ping on publish/expire (optional) | Opus | owner creates a Google Cloud service account | — |
| S1 | Company pages as "trabajá con nosotros" + `/empresas` directory | Sonnet | — | Keyword Planner block 5 (companies) |
| S2 | More cities | Sonnet | — | block 2 (cities) |
| S3 | Job-type landings (medio tiempo, sin experiencia, remoto, pasantías, temporal, freelance) | Sonnet | — | block 3 (job types) |
| S4 | Job-title landings `/empleos-de/[puesto]` from a curated dictionary | Opus | — | block 4 (job titles) |
| S5 | Salary pages `/salarios/[puesto]` | Opus | S4 (reuses its dictionary) | block 6 (salaries) |
| S6 | Labour calculators (aguinaldo, salario neto/IPS, salario mínimo) | Sonnet | owner verifies the legal constants | block 7 (labour rights) |
| S7 | Schedule field on jobs ("de lunes a viernes", fines de semana, nocturno, rotativo) + filter + landing | Opus | — | already met: 3.230 searches/mo (KEYWORDS.md) |
| S8 | CV hub: free in-browser CV builder + templates/examples + guides (`/curriculum`) | Opus | — | already met: the largest demand in the data (see §2 note) |

Order (revised 2026-09-27 after the full 24.916-phrase export, see
`docs/seo/trabajo-2026-09-27/`): **S8 and S6 first** — they are the two
biggest demands in the whole dataset and neither needs job supply to rank —
then S1, S2, S3, S7, S4, S5. S6 still waits for the owner to verify the legal
constants. S0 can go anywhere.

Demand by meaning group (monthly searches, from `clusters.md`; totals are
inflated where Keyword Planner reports the same number for close variants,
so read them as a ranking, not as traffic):

| Need | Biggest phrases | PR |
|---|---|---|
| CV: builder, templates, examples, "para llenar", sin experiencia, carta de presentación, entrevista | curriculum vitae / cv (12.100 — one Google group), modelo de curriculum vitae (1.000), cv ejemplo (1.600), curriculum vitae gratis (880), como hacer un curriculum (720), carta de presentación (320) | S8 |
| Aguinaldo, salario mínimo, jornal, preaviso, despido, horas extras | salario minimo paraguay 2026 (6.600), calculo de aguinaldo (2.900), como se calcula el aguinaldo (2.400), jornal minimo (1.300), preaviso paraguay (1.300), horas extras (480), aguinaldo proporcional (390), despido injustificado (320) | S6 (+ lawyer-reviewed guides for preaviso/despido) |
| Head terms | empleo en py (14.800), bolsa de trabajo de paraguay (8.100), empleos paraguay (5.400) | done (PLAN-GROWTH §17) |
| Company careers | trabaja con nosotros (6.600), Biggie 590, Itaú 320, Continental/Stock/Tigo 260 | S1 |
| Remote / online | trabajo(s) remoto(s) paraguay (1.300 each), trabajos remotos (880) | S3 |
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

- `/empresas/[slug]`: title `Empleos en {empresa} — trabajá con nosotros`,
  H1 `Trabajá en {empresa}`, description naming the live job count. Robots
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

### S3 — Job-type landings

- Six static routes, each a fixed filter over the existing `/empleos` query
  (`tipo`, `nivel`, `modalidad` already exist as filters):
  `/trabajo-medio-tiempo` (tipo=medio_tiempo), `/pasantias` (tipo=pasantia),
  `/trabajo-temporal` (tipo=temporal), `/trabajo-freelance`
  (tipo=freelance), `/trabajo-sin-experiencia` (nivel=sin_experiencia),
  `/trabajo-remoto` (modalidad=remoto). Demand so far: remoto 5.110/mo,
  sin experiencia 2.060, medio tiempo 1.650 — build those three first; drop
  any other with no demand. Use "vacancias" as well as "empleos" in titles
  (vacancia laboral: 1.960/mo — the Paraguayan word).
- One shared component + a definitions file (`lib/seo/job-type-landings.ts`:
  slug, filter, H1, title, intro paragraph). Paginated like the city
  landings, with `BreadcrumbList` + `ItemList` and cross-links to cities and categories.
- Indexing rule `jobTypeRobots(count)` in `lib/seo.ts`: index at ≥ 3 live
  jobs. Sitemap lists only indexable ones. The equivalent `/empleos?tipo=…`
  URLs stay as they are (listingIndexRule already noindexes filtered
  listings) — confirm, don't assume.

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
  in `lib/labor.ts` (shared with S6) with its source and date.
- Links: each salary page ↔ its `/empleos-de/[puesto]` page.

### S6 — Labour calculators

- `/calculadoras/aguinaldo`, `/calculadoras/salario-neto` (IPS worker share),
  `/calculadoras/salario-minimo` (monthly/daily/hourly). **Not liquidación**
  (despido/preaviso/indemnización) until a lawyer has reviewed it —
  PLAN-GROWTH.md §7 D14 applies.
- All figures in `lib/labor.ts`, each constant with its legal source and
  effective date in a comment; the owner verifies them against the official
  text before the PR merges (same `[VERIFICAR]` discipline as the blog
  drafts). Pure functions, client-side, no data stored.
- `scripts/verify-labor.ts`: worked examples per calculator (known inputs →
  known outputs) so a constant change that breaks the math fails CI.
- Each calculator links to its blog guide (`aguinaldo-en-paraguay`, …) and
  vice versa. These are the pages most likely to earn links from other
  sites, which is what moves "bolsa de trabajo paraguay".

### S8 — CV hub (`/curriculum`)

The single largest need in the data: people in Paraguay searching how to make
a CV, for a template, an example, a "para llenar" PDF, a free builder.
Answering it brings job seekers to the site before they search for a job.

- `/curriculum` hub + `/curriculum/crear` (builder) + a few static pages only
  where the data shows demand: modelos/plantillas, ejemplos (incl. sin
  experiencia), carta de presentación. Blog drafts that already exist
  (`carta-de-presentacion-con-ejemplo`, …) are linked, not duplicated.
- **The builder runs entirely in the browser**: a form, 3–4 clean templates,
  "Descargar PDF" through the browser's print-to-PDF with a print stylesheet
  (no PDF library, no server). **Nothing is sent to or stored on the server**
  — a CV is personal data (Ley 7593/2025), so an anonymous builder keeps it
  on the device (localStorage draft, with a "Borrar" button). Saving it to a
  candidate account is a separate, later decision that goes through the
  existing consent model (PLAN-PHASE2.md), not this PR.
- Every page ends in the job search ("Ya tenés tu CV — mirá los empleos en
  {ciudad}") and, where candidate accounts are on, "Creá tu perfil".
- Title/H1 wording from `docs/seo/trabajo-2026-09-27/clusters.md`; the full
  phrase list for each page comes from filtering `keywords.csv` in the
  Keyword Library, not from guesses.

## 3. What the owner does

1. Run the Keyword Planner blocks and merge them: download "Keyword ideas"
   as CSV and run `python3 docs/seo/kwp-merge.py <file>.csv` (or paste the
   table into a .txt and pass that). Commit the CSV.
2. S0 only: create the Google Cloud project + service account, add it as an
   owner in Search Console, put the JSON in hPanel.
3. S6 only: verify each constant in `lib/labor.ts` against the official source.
4. Request indexing for new page types in Search Console after each deploy.

## 4. Session prompts

Paste one as the first message of a fresh Claude Code session on this repo.
Use the model named in the table; never Fable for these sessions.

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

**S3 (Sonnet)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S3. Build the job-type landings
> with slugs and titles chosen from `docs/seo/keywords-2026-09-27.csv` (drop
> any without demand): one definitions file, one shared page component, reads
> through `lib/data.ts`, a `jobTypeRobots()` rule in `lib/seo.ts` asserted by
> `seo:verify`, sitemap entries only when indexable, BreadcrumbList + ItemList
> JSON-LD. Confirm, don't assume, that the equivalent `/empleos?…` filtered URLs
> stay noindexed. Verify locally; one PR.

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
> sample size, period and source. The minimum wage comes from `lib/labor.ts`. Verify
> locally; one PR.

**S6 (Sonnet)** — after the owner has verified the constants
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S6. Build the aguinaldo,
> salario-neto (IPS) and salario-mínimo calculators under `/calculadoras/`,
> every figure in `lib/labor.ts` with source and date, pure client-side
> functions, `scripts/verify-labor.ts` with worked examples wired as a step in
> the existing CI job, and cross-links with the matching blog guides. No
> liquidación calculator. Verify locally; one PR.

**S7 (Opus)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S7. Add the nullable
> `jobs.schedule` enum with a Drizzle migration (no FK), set it from every job
> write path (admin JobForm, employer dashboard form, the optional field on
> /publicar via the shared Zod schema), show it on the job page, card and
> JobPosting `workHours`, add the `horario` filter to /empleos and the
> `/trabajo-de-lunes-a-viernes` landing with the S3 indexing rule. Keep seed
> and DB in parity. Verify locally, including `db:test` if a database is
> available; one PR.

**S8 (Opus)**
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S8. Build the CV hub: `/curriculum`,
> `/curriculum/crear` (in-browser builder, 3–4 templates, PDF via print
> stylesheet, draft in localStorage with a delete button, **no server
> storage and no network call with CV data**) and the static pages the data
> supports (modelos/plantillas, ejemplos incl. sin experiencia, carta de
> presentación). Pick titles and headings from
> `docs/seo/trabajo-2026-09-27/clusters.md`. Link existing blog drafts instead
> of duplicating them; every page ends in the job search. Add the pages to the
> sitemap with BreadcrumbList. Spanish (Paraguay) copy, no promises of
> interviews or jobs. Verify locally (lint, typecheck, build, seo:verify);
> one PR.

**S0 (Opus)** — after the owner has set `GOOGLE_INDEXING_SA_JSON`
> Read AGENTS.md and PLAN-SEO.md §1 and §2 S0. Implement the Indexing API
> notifications exactly as specified: `server-only`, JWT signed with
> `node:crypto`, run in `after()`, no-op when the env var is unset, only
> `/empleos/[slug]` URLs, `URL_DELETED` for expiries from the listing-confirm
> chore, and `scripts/verify-indexing.ts` wired into the existing CI job.
> Document the env var in `.env.example` and README. Verify locally; one PR.
