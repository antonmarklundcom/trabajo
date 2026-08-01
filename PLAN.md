# PLAN.md — trabajo.com.py

> **Rewritten 2026-08-01 by Opus 5.** Supersedes the 2026-07-16 Fable 5 plan,
> which assumed WordPress + JetEngine as the backend. That assumption is
> dropped — see §2. Phases 0–2 of the old plan are done and are folded into
> "what exists" below.
>
> Read `AGENTS.md` first: this repo runs **Next.js 16**. APIs, conventions and
> file structure differ from training data — consult
> `node_modules/next/dist/docs/` before writing any code. Every phase below
> starts with `npm install` for that reason.
>
> Companion docs: `ARCHITECTURE.md` (target design + schema),
> `MIGRATION.md` (cutover), `DEPLOY.md` (Hostinger + MySQL).

---

## 1. Business model (unchanged, owner-confirmed)

- Spanish-language job board for Paraguay. **Free for job seekers, always.**
- Revenue: employer plans (Básico free / Destacado / Empresa). **Sales and
  collection are manual** via WhatsApp + CRM. No online payments at launch;
  `/planes` shows "Consultar".
- Job supply: the owner's team curates and posts listings. Employer
  self-submission with team approval comes later. No scraping/aggregation.
- Hosting: Hostinger Node.js app, auto-deploy from `main`.

Explicitly out of scope (owner-confirmed): online payments, seeker
accounts/logins, CV database, job aggregation.

---

## 2. The backend decision

**Replace WordPress + JetEngine with a first-party MySQL backend in this repo.**

The rationale, verified against the code rather than assumed:

- WP was never load-bearing. `.env.example` ships `USE_WP_BACKEND=false`, so
  production has always served the 28 jobs in `lib/seed/jobs.json`. The jobs in
  the panel are placeholders.
- **Migration cost is therefore zero today** and rises with every real listing
  entered into WP. This is the cheapest moment this decision will ever have.
- `lib/wp.ts` (413 lines) was never verified end-to-end against the live panel —
  the old Phase 2 item 4 is still open because the remote session's network
  policy blocked `panel.trabajo.com.py`. That verification work disappears
  entirely instead of being paid for.
- The revenue-critical features — employer accounts, moderation/approval,
  `featuredUntil` fulfilment after a manual sale, an audit trail — are exactly
  where JetEngine turns into a pile of plugins, and exactly what already works
  cleanly in the propia stack.
- One deploy surface, one login for the team, no second CMS to patch.

The honest cost: WordPress gave the curation team a free editor UI. Going
custom means building `/admin` (Phases C–E below). That is the work.

Structurally the swap is small because `lib/data.ts` is a real seam — eight
functions, and no page, component or API route reads a data source directly.

---

## 3. What already exists (verified against code)

- Full public frontend: home, `/empleos` (URL-driven filters, pagination,
  sort), `/empleos/[slug]` (+ JSON-LD JobPosting), `/trabajo/[categoria]` and
  `/trabajo/[categoria]/[ciudad]` SEO landings, `/publicar`, `/planes`,
  `/contacto`, `not-found`, `sitemap.xml`, `robots.txt`.
- Public v1 REST API: jobs, job-by-slug, categories, cities, leads.
- **The data seam** (`lib/data.ts`) — the reason this migration is cheap.
- **Lead routing, complete**: zod-validated `POST /api/v1/leads`, `201`-then-
  `after()` fan-out to `GHL_WEBHOOK_URL` + `GOOGLE_SHEETS_WEBHOOK_URL` with
  retries/backoff, `sendBeacon` on WhatsApp clicks, graceful degradation when
  webhooks are unset.
- Analytics (GA4, gated on `NEXT_PUBLIC_GA_ID`), `/privacidad` + `/terminos`,
  branding assets incl. dynamic job OG images.
- Seed data: 28 jobs, 10 categories, 7 cities. Warm PY red/gold redesign.
- CI: GitHub Actions build on push/PR.

---

## 4. Model tiering

| Use | Model |
|---|---|
| Schema design, security-sensitive code (sessions, password handling, authorization helpers), caching correctness on Next 16, the data cutover itself, phase-gate review | **Opus 5** |
| Everything else: CRUD screens, forms, admin pages, seed/import scripts, copy, wiring, tests | **Sonnet 5** |

Rule of thumb: if getting it subtly wrong leaks data, loses data, or silently
serves stale/unapproved content, it's Opus. If it's mechanical work against a
spec that already exists in `ARCHITECTURE.md`, it's Sonnet.

Phases below are marked accordingly. Most of the build is Sonnet.

---

## 5. Open questions (defaults assumed — flip any without a rewrite)

The docs are written against these defaults. None of them block starting
Phase A.

1. **Who posts jobs in v1?** *Assumed: team/admin only.* Employers keep
   submitting via `/publicar` as today; the team creates the post. Employer
   self-serve accounts are Phase G, and the schema already carries the
   `employer` role and `company_id` so adding it is not a migration.
2. **Where do leads land?** *Assumed: DB as system of record + the existing
   GHL/Sheets fan-out kept exactly as-is.* VenderCRM is specced as an optional
   third sink gated on `VENDERCRM_API_KEY` (`ARCHITECTURE.md` §7). Say the word
   and it becomes primary instead.
3. **Store job applications as rows?** *Assumed: yes* (Phase E) — one row per
   application so admin can see applicants per job. Still no seeker logins and
   no CV database. Drop Phase E if you'd rather stay WhatsApp-only.
4. **Database?** *Assumed: Hostinger MySQL + Drizzle*, matching propia. The
   alternative in your deploy skill is Neon + Prisma, which carries the known
   Hostinger IPv6-routing problem for one-off scripts.
5. **Hostinger slot** — trabajo presumably already occupies one; the custom
   backend needs no additional slot, only a MySQL database on the same account.
   Worth confirming before Phase F.

---

## 6. Phases

### Phase A — Foundation *(Sonnet)*
1. `npm install`; read the Next 16 docs for anything touched below.
2. Add `drizzle-orm`, `mysql2`, `bcrypt`, `iron-session`; dev: `drizzle-kit`,
   `tsx`.
3. `drizzle.config.ts`, `lib/db/index.ts` (single pool, `connectionLimit: 8`,
   `timezone: "Z"`), `lib/db/schema.ts` exactly per `ARCHITECTURE.md` §4.
4. Generate + run the first migration against a local/dev MySQL.
5. `scripts/seed-import.ts` — idempotent upsert (`onDuplicateKeyUpdate` by
   slug) importing `lib/seed/*.json`: categories, cities, one company row per
   distinct company name, then jobs with `status='published'` and
   `published_at = postedAt`. Re-running it must not duplicate anything.
6. `.env.example`: add `DATABASE_URL`, `DATA_SOURCE`, `SESSION_SECRET`.

**Gate:** `npx tsx scripts/seed-import.ts` twice in a row leaves 28 jobs, 10
categories, 7 cities — not 56.

### Phase B — Read path + parity *(Sonnet, with one Opus checkpoint)*
1. `lib/db/queries.ts` implementing the eight seam functions with identical
   signatures and semantics (`ARCHITECTURE.md` §3 — page size 20, featured
   float, `salarioMin` excluding hidden salaries, published-only `jobCount`).
2. Single exported visibility predicate; every public query uses it.
3. `DATA_SOURCE` switch in `lib/data.ts` with the `USE_WP_BACKEND` fallback.
4. **Parity check**: a script or test that runs a fixed matrix of filter/sort/
   page combinations against both `seed` and `db` and diffs the results. Any
   difference is a bug in the DB path, not an acceptable variation.
5. **Opus checkpoint — caching.** Decide and implement the caching +
   invalidation strategy for this Next version (`ARCHITECTURE.md` §8). Do not
   port `unstable_cache`/`revalidateTag` patterns from memory.

**Gate:** with `DATA_SOURCE=db` the whole public site renders identically to
seed — listings, filters, detail pages, taxonomy counts, sitemap. No page files
changed in this phase.

### Phase C — Auth + admin shell *(Opus for auth core, Sonnet for screens)*
1. **Opus**: `lib/auth.ts` — iron-session (userId only, role read from DB per
   request), bcrypt cost 12, `requireSession()` / `requireRole()`,
   login rate-limiting. `scripts/create-user.ts` and
   `scripts/set-password.ts`.
2. **Sonnet**: `/admin/login`, admin layout + nav, `/admin` dashboard,
   `noindex` on all admin routes and exclusion from `sitemap.ts`/`robots.ts`.
3. **Sonnet**: `/admin/empleos` list (filter by status, search) and the
   create/edit form (one component, optional `id` prop), `/admin/empresas`,
   `/admin/usuarios` (admin role only).
4. Every mutation route re-checks the role server-side. Hidden buttons are UX,
   not security.

**Gate:** a real editor account can log in and create, edit and publish a job
that appears on the live public site. A logged-out request to any `/admin` or
`/api/admin` route is rejected — verified, not assumed.

### Phase D — Approval workflow *(Sonnet)*
1. `/publicar` creates a `pending` job **and** fires the existing lead fan-out
   unchanged.
2. Admin queue: approve → `published` (sets `published_at`), reject → with
   `rejection_reason`, archive.
3. `featured_until` set from the job edit screen after a manual sale; the
   existing badge logic needs no change.
4. `activity_log` written on every approve/reject/publish/feature/delete.
5. Honeypot + rate limit on `/api/v1/leads`.

**Gate:** employer submits at `/publicar` → lead reaches WhatsApp/GHL
immediately → admin approves → the job is live. End to end, ≤24 h turnaround.

### Phase E — Applications inbox *(Sonnet — see open question 3)*
1. `applications` table + insert from the application form, before the fan-out.
2. `/admin/postulaciones` — filter by job, mark reviewed/contacted/discarded.
3. Applicant count surfaced per job in `/admin/empleos`.

**Gate:** an application submitted on the public site appears in the admin
inbox and still reaches WhatsApp/GHL.

### Phase F — Cutover *(Sonnet + owner ops — follow `MIGRATION.md`)*
1. Provision MySQL on Hostinger; run migrations and the seed import from a
   local machine (`DEPLOY.md` — remote MySQL IP allowlisting, `tsx` not loading
   `.env`, the stale-password trap).
2. Team enters real listings via `/admin`.
3. Set `DATA_SOURCE=db` in hPanel, redeploy, verify.
4. Delete `lib/wp.ts`, `WP_API_URL`, `USE_WP_BACKEND`; retire `lib/seed/*.json`
   from the read path (keep the files as import fixtures).
5. Decommission `panel.trabajo.com.py`.

**Gate:** production serves real jobs from MySQL; no WP references remain in
the codebase or env.

### Phase G — Launch & beyond
- Owner ops: real `NEXT_PUBLIC_WHATSAPP_LEADS`, GHL webhook + Sheets sink
  configured, Search Console verified and sitemap submitted.
- Final smoke test (mobile + desktop), Lighthouse, Rich Results test on a live
  job.
- SEO scale-out: `noindex` on empty category/city combos to avoid thin pages,
  breadcrumbs + BreadcrumbList JSON-LD, internal linking.
- **Then, only if real inbound employer demand shows up in the CRM**: employer
  self-serve accounts (open question 1). The schema already supports it.

---

## 7. Estimate

Phases A–B: one Sonnet session plus a short Opus checkpoint. Phase C: one
session (auth core is the Opus part, screens are Sonnet). Phases D–E: one
session. Phase F: half a session plus owner ops on Hostinger.

**≈3–4 build sessions**, most of it Sonnet, plus the content operations of
entering real listings — which is now the actual critical path to launch, not
code.

---

## 8. Reusable across the portfolio

Three patterns here are worth lifting into skills rather than re-deriving:

- The **data seam** (`lib/data.ts`) — a swappable backend behind one module is
  what makes this migration a config change instead of a rewrite.
- The **lead-routing spec** (`lib/leads.ts` + `app/api/v1/leads/route.ts`):
  zod-validated orchestrator, flat snake_case payload, parallel fan-out with
  backoff, `sendBeacon` leave-page safety, graceful degradation.
- The **status + approval + activity_log** pattern from `ARCHITECTURE.md` §4/§6,
  which is the same shape any listings or directory site needs.
