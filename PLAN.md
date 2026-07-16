# PLAN.md — trabajo.com.py

> **Authored by Fable 5** (planning/architecture model) — handoff to **Sonnet 5 / Opus 4.8** for build work.
> Status date: 2026-07-16. Owner review pending; not yet committed as canon.

## Model tiering

- **Fable 5**: architecture, spec/schema decisions, gap analysis, phase-gate reviews. Do **not** burn Fable time on routine implementation.
- **Sonnet 5**: default for all build sessions below (pages, forms, config, content plumbing). Every phase here is Sonnet-suitable unless marked.
- **Opus 4.8**: escalate only for genuinely hard problems (e.g. tricky ISR/caching bugs against the live WP backend, subtle SEO/structured-data regressions). None are anticipated.

Read `AGENTS.md` first: this repo runs **Next.js 16** — consult `node_modules/next/dist/docs/` before writing code; APIs may differ from training data.

## Business model (confirmed with owner)

- **Product**: Spanish-language job board for Paraguay (trabajo.com.py). Free for job seekers, always.
- **Revenue**: employer plans (Básico free / Destacado / Empresa). **Sales and collection are manual** via WhatsApp + GoHighLevel — no online payments at launch. Prices stay "Consultar" on `/planes`.
- **Job supply**: short term, owner's team curates and posts jobs (into WordPress/JetEngine). Later, employer submissions via `/publicar` with team approval. No aggregation/scraping planned.
- **Backend**: WordPress + JetEngine at `panel.trabajo.com.py` is live; current jobs there are fake placeholders. Replacing them with real listings is an **ops task, not a code task** — the code path (`lib/wp.ts`) is already built.
- **Hosting**: Hostinger Node.js app, auto-deploy from `main`.

## What already exists (verified against code, not assumed)

- Full frontend: home, `/empleos` (URL-driven filters, pagination, sort), `/empleos/[slug]` (detail + JSON-LD JobPosting), `/trabajo/[categoria]` and `/trabajo/[categoria]/[ciudad]` SEO landings, `/publicar`, `/planes`, `/contacto`, `not-found`, sitemap.xml, robots.txt.
- v1 REST API: jobs, job-by-slug, categories, cities, leads.
- **Data seam** (`lib/data.ts`): every consumer goes through one module; `USE_WP_BACKEND` env switches seed JSON ↔ live WordPress with zero page changes.
- **`lib/wp.ts` is complete** (no TODOs): maps live CPTs `empleos`/`empresas`, taxonomies `ciudad`/`categoria`, JetEngine relation #4, media; ISR-cached (300 s), no N+1.
- **Lead routing is complete**: zod-validated `POST /api/v1/leads`, 201-then-`after()` fan-out to `GHL_WEBHOOK_URL` + `GOOGLE_SHEETS_WEBHOOK_URL` with retries/backoff, `sendBeacon` on WhatsApp clicks, graceful degradation when webhooks are unset.
- Seed data: 28 jobs, 10 categories, 7 cities. Visual redesign (warm PY red/gold) applied.
- CI: GitHub Actions build on push/PR. Deploy flow documented in README.

## Gap analysis — what's needed to finish

| Gap | Type | Phase |
|---|---|---|
| GHL + Google Sheets webhooks not configured (env vars empty) | Ops | 2 |
| Real WhatsApp leads number (`NEXT_PUBLIC_WHATSAPP_LEADS`) | Ops | 2 |
| No analytics | Code | 2 |
| No legal pages (privacidad, términos) | Code | 2 |
| No OG image / social share branding; default Next favicon assets in `/public` | Code | 2 |
| `lib/wp.ts` never verified against live panel end-to-end | Code+Ops | 2 |
| Real job inventory (replace fake JetEngine jobs) | Ops | 3 |
| SEO scale-out: more landing combos, internal linking, Search Console | Code+Ops | 3 |
| Employer submission → moderation workflow beyond a raw lead | Code+Ops | 4 |
| Featured-plan fulfilment process (set `featuredUntil` after manual sale) | Ops | 4 |

Explicitly **out of scope** (owner-confirmed): online payments, seeker accounts/CV database, job aggregation.

## Phased milestones

### Phase 0 — Spec & decisions ✅ DONE
Seed-first/WP-ready architecture, data seam, Job schema, lead-routing spec. All shipped and documented in README.md.

### Phase 1 — Core build ✅ DONE
All pages, components, API routes, WP integration, lead fan-out, redesign, CI. (PRs #1–#5.)

### Phase 2 — Launch readiness (1 Sonnet session + owner ops)
Code:
1. Analytics: lightweight, privacy-friendly (Plausible or GA4 — Sonnet may default to GA4 via a small script component gated on an env var). Track page views + lead-submit + WhatsApp-click events.
2. Legal pages: `/privacidad` and `/terminos` (Spanish, Paraguay-appropriate boilerplate), linked from Footer.
3. Branding assets: real favicon set, `opengraph-image` (site-wide + job-detail dynamic OG optional), remove leftover Next.js SVGs in `/public`.
4. Live-WP verification pass: run locally with `USE_WP_BACKEND=true` against the panel; confirm listing, detail, filters, taxonomy counts, featured logic, sitemap all render from WP data. Fix mapping bugs if found.

Owner ops (parallel, no code):
- Create GHL inbound-webhook workflow + Apps Script sheet sink; set env vars in Hostinger (README has step-by-step).
- Set real `NEXT_PUBLIC_WHATSAPP_LEADS`.
- Google Search Console: verify domain, submit sitemap.

**Gate (Fable review): site launchable — real leads flow to GHL/Sheets/WhatsApp, legal + analytics in place, WP path proven.**

### Phase 3 — Content & SEO (1 Sonnet session + ongoing ops)
Code:
1. Expand SEO surface: index pages `/trabajo` (all categories) and per-city hub if missing; strengthen internal linking (related jobs, category↔city cross-links, breadcrumbs + BreadcrumbList JSON-LD).
2. Metadata audit: unique titles/descriptions per landing combo, canonical tags, empty-state copy for combos with 0 jobs (avoid thin-content indexing — `noindex` empty combos).
3. Optional: `/guias` content section (salary guides, CV tips) only if owner wants it — cheap SEO fuel, but content must come from the team.

Owner ops:
- Team replaces fake JetEngine jobs with real curated listings (target: enough per top category/city that landings aren't empty); flip `USE_WP_BACKEND=true` in Hostinger when inventory is real.

**Gate: real inventory live via WP, landings indexed, no thin pages.**

### Phase 4 — Employer self-serve v1 + revenue ops (1 Sonnet session)
1. Upgrade `/publicar` from bare lead to structured job draft (all Job-schema fields, preview) — still lands as a lead in GHL; team approves and creates the post in WP. No auth needed.
2. Document the featured-plan fulfilment runbook (manual sale → set `featuredUntil` in WP → badge appears automatically; logic already exists).
3. Lead-quality niceties if needed: honeypot/rate-limit on `/api/v1/leads`.

**Gate: employer → published-job pipeline works end-to-end with ≤24 h turnaround.**

### Phase 5 — Launch & graduate (½ session)
- Final smoke test on production (mobile + desktop), Lighthouse pass, structured-data validation (Rich Results test on a live job).
- Announce/marketing is owner-side. Repo graduates to maintenance: seed JSON path retired, changes driven by real usage.

## Estimate

**~3–3.5 build sessions to launch-ready** (Phases 2–4), all Sonnet 5, plus owner ops work that gates Phases 2–3. The codebase is already ~90 % of the way to launch; remaining work is mostly configuration, trust/branding surface, and content operations.

## Reusable across the portfolio

This repo's **lead-routing spec** (zod-validated orchestrator route, flat snake_case payload, GHL + Sheets fan-out with retries, `sendBeacon` leave-page safety — `lib/leads.ts` + `app/api/v1/leads/route.ts` + README section) and the **seed-first/data-seam pattern** (`lib/data.ts`) are portable to sibling lead-gen sites and should be lifted as a shared spec/skill rather than re-derived.

## Open questions for owner (non-blocking)

1. Analytics preference: GA4 vs Plausible (plan defaults to GA4 if unanswered).
2. Do you want the `/guias` content section in Phase 3, or skip it?
3. Should Phase 4's structured `/publicar` form wait until real inbound employer demand shows up in GHL?
