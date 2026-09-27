# Keyword research — Google Keyword Planner, 2026-09-27

Raw data: [`keywords-2026-09-27.csv`](keywords-2026-09-27.csv) — one row per
unique phrase: `phrase, monthly_searches, low_cpc_sek, high_cpc_sek`.

Add new data with `python3 docs/seo/kwp-merge.py <file>`. It takes either the
planner's **"Download keyword ideas" CSV** (preferred — Swedish, English or
Spanish UI, UTF-16 or UTF-8) or a `.txt` copy-paste of the table; keeps
existing rows, appends new phrases, re-sorts by volume. Put raw exports in
`docs/seo/raw/` if you want to keep them. The build plan that uses this data
is `PLAN-SEO.md`.

- **Location / language:** Paraguay, Spanish (the first "publicar … gratis"
  batch may have been pulled with a different location — re-check it before
  relying on it).
- **Volumes** are Keyword Planner's rounded monthly averages. `0` means the
  planner showed `0` or `—` (no data).
- **CPC** is the top-of-page bid range in **Swedish kronor** (the Ads account's
  currency), `0` when the planner showed none. Divide by the day's SEK/PYG rate
  to plan a guaraní budget.
- Trend and competition columns were dropped on purpose.

## Where each cluster points

| Cluster | Top phrases (monthly searches) | Target page | Status |
|---|---|---|---|
| Brand-less head terms | empleos py (14.800), bolsa de trabajo paraguay (8.100), bolsa de empleo en paraguay (590), bolsa de trabajo en py (390), ofertas laborales en paraguay (390), bolsas de empleo (390) | `/` | Title "Empleos PY — Bolsa de trabajo en Paraguay", "Bolsa de trabajo en Paraguay" text block with city links |
| Seeker, national | busco trabajo (590), busco trabajo en paraguay (320), oferta de trabajo en paraguay (260), busca empleo paraguay (210), vacantes de trabajo en paraguay (170), oferta laboral paraguay (110) | `/empleos` | Title "Ofertas laborales en Paraguay — todos los empleos" |
| City | bolsa de trabajo en asuncion (1.300), bolsa de trabajo asuncion paraguay (30) | `/trabajo-en/[ciudad]` | Title + H1 "Bolsa de trabajo en {ciudad}" for every city |
| Cities we have no landing for | caacupe (40), concepción (40), pedro juan caballero (40), caaguazu (30) | — | Needs a `cities` row each; only worth it once those cities have listings |
| Part-time / students | trabajos de medio tiempo para estudiantes paraguay (90), bolsa de trabajo paraguay medio tiempo (70) | — | Candidate for a filter landing (modalidad = medio tiempo) or a blog guide |
| Profession | bolsa de trabajo para ingenieros en paraguay (50), … para docentes (30) | — | Category landings / blog |
| Employer, evergreen | busco empleados (110), buscar personal (90), busco personal (20), se necesita personal, necesito personal, contratar personal, reclutamiento / selección de personal (30 each), anuncios de empleo, clasificados de empleo | `/buscar-personal` | New page, indexed, in the sitemap and footer |
| Employer, "gratis" | publicar empleos gratis, publicar trabajos gratis, publicar ofertas de empleo gratis, paginas para publicar empleos gratis, plataformas para publicar vacantes gratis (all ~10) | `/publicar-gratis` (permanent, indexed) + blog draft `paginas-para-publicar-empleos-gratis-en-paraguay` | Page sells the promotion when one runs and says honestly when none does (PLAN-GROWTH.md §18). Also the Google Ads landing |
| Competitor brand | computrabajo paraguay (590), computrabajo empresas, publicar en computrabajo | — | Ads only, never page copy naming them |

## Not ours

"busco trabajo en new york / estados unidos", "linkedin …", "milanuncios …",
"inem", "eures" — other countries or other products; ignore.

## What the 2026-09-27 seeker export says (3.414 rows, `raw/keyword-stats-2026-09-27-seekers.csv`)

Theme totals (sum of monthly searches over every phrase matching the theme;
computed by script, not read row by row):

| Theme | Phrases | Searches/mo | Top phrases | What it means for us |
|---|---|---|---|---|
| "trabaja con nosotros" / company careers | 110 | 8.470 | trabaja con nosotros (6.600), mcdonald's (170), coca cola (140), bimbo (90) | PLAN-SEO S1 is the biggest single opportunity |
| Remote / online / desde casa | 116 | 5.110 | trabajos remotos paraguay (1.300), trabajos remotos (880), trabajo online paraguay (390) | First job-type landing (S3): `/trabajo-remoto` |
| Schedule: "de lunes a viernes", nocturno | 106 | 3.230 | busco trabajo de lunes a viernes en paraguay (1.300), trabajo nocturno paraguay (210) | We have **no schedule field** — product gap (PLAN-SEO S7) |
| Public sector / ministries | 158 | 2.860 | ministerio de justicia y trabajo (1.600 — navigational), empleo público (260) | Mostly not ours; a blog guide to "concursos públicos" at most |
| Sin experiencia / primer empleo | 153 | 2.060 | …lunes a viernes sin experiencia (320), trabajo en paraguay sin experiencia (260) | `/trabajo-sin-experiencia` (S3) |
| "Vacancia" (Paraguayan word) | 33 | 1.960 | vacancia laboral (480), vacancia laboral paraguay (320), vacancias laborales en paraguay (320) | Use "vacancias" in titles and copy alongside "empleos" |
| Medio tiempo / fin de semana / estudiantes | 96 | 1.650 | trabajo medio tiempo paraguay (320), trabajos de fin de semana en paraguay (110) | `/trabajo-medio-tiempo` (S3); weekends need S7 |
| Gender / age ("para mujeres", "jóvenes") | 69 | 1.000 | empleos para mujeres en paraguay (260) | **Do not build gender pages** — job ads must not discriminate (/terminos §5). Blog content at most |

Cities (sum over phrases naming the city): Asunción 3.910, Encarnación 930,
Ciudad del Este 610, Luque 500, Capiatá 370, **Caaguazú 330**, **Mariano
Roque Alonso 280**, **Ñemby 240**, **Caacupé 220**, **Coronel Oviedo 210**,
San Lorenzo 190, **Pedro Juan Caballero 180**, **Limpio 120**, **Itauguá 120**,
Villarrica 80. Bold = no city landing yet → PLAN-SEO S2.

Not in this export (still to download): salaries, CV/interviews, labour rights,
job titles — PLAN-SEO blocks 4, 6, 7, 8.

