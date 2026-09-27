# Keyword research — Google Keyword Planner, 2026-09-27

Raw data: [`keywords-2026-09-27.csv`](keywords-2026-09-27.csv) — one row per
unique phrase: `phrase, monthly_searches, low_cpc_sek, high_cpc_sek`.

Add a new Keyword Planner paste with `python3 docs/seo/kwp-merge.py paste.txt`:
it parses the planner's copy-paste format, keeps existing rows, appends new
phrases and re-sorts by volume.

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
