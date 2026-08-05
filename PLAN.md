# PLAN.md — trabajo.com.py

> **Rewritten 2026-08-05 by Opus 5.** Supersedes the 2026-08-01 plan. That plan
> was written before Phases A and B existed; both are now merged into `main`
> (PR #9), so the phase list has been replaced by a **numbered list of 12
> discrete PR-sized steps** with model tiers, dependencies and PR batching.
> The backend decision itself (§2) is unchanged and still correct.
>
> Read `AGENTS.md` first: this repo runs **Next.js 16**. APIs, conventions and
> file structure differ from training data — consult
> `node_modules/next/dist/docs/` before writing any code. Every session starts
> with `npm install` for that reason.
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
- Hosting: Hostinger Node.js app, **auto-deploys from `main`. There is no
  staging environment** — a merge to `main` is a production deploy.

Explicitly out of scope (owner-confirmed): online payments, seeker
accounts/logins, CV database, job aggregation.

---

## 2. The backend decision (unchanged)

**Replace WordPress + JetEngine with a first-party MySQL backend in this repo.**

- WP was never load-bearing. `USE_WP_BACKEND=false` has always been the
  production setting, so the live site serves the 28 jobs in
  `lib/seed/jobs.json`. The listings in the WP panel are placeholders.
- **Migration cost is therefore zero**, and rises with every real listing
  entered into WP. This remains the cheapest moment for this decision.
- `lib/wp.ts` (413 lines) was never verified end-to-end against the live panel;
  that verification work disappears instead of being paid for.
- The revenue-critical features — employer accounts, moderation/approval,
  `featured_until` fulfilment after a manual sale, an audit trail — are exactly
  where JetEngine becomes a pile of plugins, and exactly what the propia stack
  (Next.js + Drizzle + MySQL on Hostinger) already does cleanly.

The honest cost: WordPress gave the curation team a free editor UI. Going
custom means building `/admin` — steps 2–5 and 7–9 below. That is the work.

---

## 3. Where the project actually stands (verified against code, 2026-08-05)

**Done and merged to `main`:**

- Full public frontend: home, `/empleos` (URL-driven filters, pagination,
  sort), `/empleos/[slug]` (+ JSON-LD JobPosting), `/trabajo/[categoria]` and
  `/trabajo/[categoria]/[ciudad]` SEO landings, `/publicar`, `/planes`,
  `/contacto`, `not-found`, `sitemap.xml`, `robots.txt`.
- Public v1 REST API: jobs, job-by-slug, categories, cities, leads.
- **Lead routing, complete**: zod-validated `POST /api/v1/leads`, `201`-then-
  `after()` fan-out to `GHL_WEBHOOK_URL` + `GOOGLE_SHEETS_WEBHOOK_URL` with
  retries/backoff, `sendBeacon` on WhatsApp clicks, graceful degradation when
  webhooks are unset. **Do not rewrite this** — the new backend hooks into it
  additively (`ARCHITECTURE.md` §7).
- **Phase A (foundation)**: `drizzle-orm` + `mysql2` + `bcrypt` +
  `iron-session` installed, `drizzle.config.ts`, `lib/db/index.ts` (pooled,
  `connectionLimit: 8`, `timezone: "Z"`), `lib/db/schema.ts` with all seven
  tables, migration `drizzle/0000_smooth_shadowcat.sql`,
  `scripts/seed-import.ts` (idempotent upserts by slug).
- **Phase B (read path)**: `lib/db/queries.ts` implementing all eight seam
  functions, the single exported `visiblePredicate()`, the three-valued
  `DATA_SOURCE` switch in `lib/data.ts` with `USE_WP_BACKEND` fallback, and
  `scripts/parity-check.ts` diffing seed vs. db across a filter/sort/page
  matrix.
- Analytics (GA4), `/privacidad` + `/terminos`, dynamic job OG images, 28 seed
  jobs / 10 categories / 7 cities, CI build on push/PR.

**Written but never executed — this is the real open risk:**

Phases A and B are *code-complete and unverified*. No MySQL database has been
provisioned, so `drizzle-kit migrate`, `scripts/seed-import.ts` and
`scripts/parity-check.ts` have never actually run against a database. Their
gates ("run the importer twice, get 28 jobs not 56"; "db output matches seed
byte-for-byte") are unproven. **Step 1 exists solely to close that gap, and
nothing downstream should be trusted until it passes.**

Also open: the app has no `db:*` npm scripts, and cache invalidation on write
(step 6) has not been designed — pages currently rely on route-segment
`export const revalidate` (30–3600s), which is fine for reads but means an
editor who publishes a job will not see it immediately.

---

## 4. Model tiering

**Default is Sonnet 5.** Opus is reserved for work where getting it subtly
wrong leaks data, loses data, or silently serves stale/unapproved content.

Exactly two of the twelve steps are Opus:

| Step | Why Opus |
|---|---|
| **2 — auth core** | Session/cookie handling, bcrypt, and the `requireRole` helper every mutation depends on. A subtle mistake here exposes `/admin` to the public internet on a repo that auto-deploys to production. Compounded by Next 16's cookie/request APIs differing from training data — this must be written from `node_modules/next/dist/docs/`, not memory. |
| **6 — cache invalidation** | Next 16's caching primitives are the single most changed area versus training data. Getting it wrong either serves stale/unapproved listings after an admin write, or drops caching entirely and hits the 8-connection MySQL pool with a per-request query storm. |

Everything else — schema tweaks, CRUD screens, forms, admin UI, migration and
seed scripts, copy, wiring, SEO — is Sonnet. It is mechanical work against a
spec that already exists in `ARCHITECTURE.md`.

---

## 5. Open questions (defaults assumed — flip any without a rewrite)

1. **Who posts jobs in v1?** *Assumed: team/admin only.* Employers keep
   submitting via `/publicar`; the team creates the post. Employer self-serve
   is post-launch; the schema already carries the `employer` role and
   `company_id`, so adding it is not a migration.
2. **Where do leads land?** *Assumed: DB as system of record + the existing
   GHL/Sheets fan-out kept exactly as-is.* VenderCRM is specced as an optional
   third sink gated on `VENDERCRM_API_KEY` (`ARCHITECTURE.md` §7).
3. **Store job applications as rows?** *Assumed: yes* (step 8) — one row per
   application so admin can see applicants per job. Still no seeker logins, no
   CV database. Drop step 8 if you'd rather stay WhatsApp-only.
4. **Database?** *Assumed: Hostinger MySQL + Drizzle*, matching propia. The
   alternative (Neon + Prisma) carries the known Hostinger IPv6-routing problem
   for one-off scripts.
5. **Hostinger slot** — trabajo presumably already occupies one; the custom
   backend needs no additional slot, only a MySQL database on the same account.
   Confirm before step 10.
6. **Where does step 1's verification run?** Gates A/B need a real MySQL. A
   remote Claude session's egress IP is ephemeral and cannot be reliably
   allowlisted in Hostinger's Remote MySQL panel, so the honest options are
   (a) a MySQL instance inside the session container, or (b) the owner runs the
   scripts locally against Hostinger and pastes the output back. Step 1 is
   written to work either way.

---

## 6. The twelve steps

Each step is one PR. Every step ends with `npm install && npm run build`
passing locally — Hostinger deploys `main` on merge, with no staging.

### Step 1 — Close the Phase A/B verification gap *(Sonnet)*
**Does:** adds `db:generate`, `db:migrate`, `db:seed`, `db:parity` npm scripts;
makes `scripts/seed-import.ts` and `scripts/parity-check.ts` fail loudly with a
readable message when `DATABASE_URL` is unset (the `tsx`-doesn't-load-`.env`
trap from `DEPLOY.md`); adds `scripts/verify-db.ts` printing row counts per
table; then **actually runs** migrate → seed → seed again → parity and records
the output in the PR body. Fixes any bug the run exposes.
**Touches:** `package.json` (scripts block only), `scripts/*`, `DEPLOY.md`.
**Depends on:** nothing. **Blocks:** everything.
**Not allowed to touch:** `drizzle.config.ts`, `lib/db/index.ts`,
`DATABASE_URL` handling.

### Step 2 — Auth core *(**Opus**)*
**Does:** `lib/auth.ts` — iron-session cookie holding **only `userId`**, role
read from the DB per request (`ARCHITECTURE.md` §5); bcrypt cost 12;
`requireSession()` / `requireRole()`; login attempt rate-limiting;
`scripts/create-user.ts` and `scripts/set-password.ts`. Session/cookie code
written from `node_modules/next/dist/docs/`, not from an App Router snippet in
memory. No UI in this PR.
**Touches:** `lib/auth.ts`, `scripts/`, `.env.example` (`SESSION_SECRET` doc).
**Depends on:** 1.

### Step 3 — Admin shell + login *(Sonnet)*
**Does:** `/admin/login` (Spanish UI), admin layout + nav, `/admin` dashboard
(pending count, recent activity), `noindex` on every admin route, exclusion
from `sitemap.ts` and `robots.ts`. Logged-out access to any `/admin` route
redirects to login — verified, not assumed.
**Touches:** `app/admin/*`, `app/robots.ts`, `app/sitemap.ts`.
**Depends on:** 2.

### Step 4 — Jobs CRUD *(Sonnet)*
**Does:** `/admin/empleos` list (status filter, search), `/admin/empleos/nuevo`
and `/admin/empleos/[id]` sharing one form component (optional `id` prop), and
the mutation handlers under `/api/admin/`. Slug generation with collision
suffix. **Editing the slug of a published job must warn and require a 301** —
slugs are live SEO URLs (`AGENTS.md`). Every handler re-checks the role
server-side.
**Touches:** `app/admin/empleos/*`, `app/api/admin/empleos/*`,
`lib/db/queries.ts` (admin-side reads, kept separate from the public
visibility predicate).
**Depends on:** 3.

### Step 5 — Companies + users CRUD *(Sonnet)*
**Does:** `/admin/empresas` (company CRUD, logo URL, WhatsApp) and
`/admin/usuarios` (admin role only; create/disable users, never hard-delete —
`is_active` exists to preserve the audit trail).
**Touches:** `app/admin/empresas/*`, `app/admin/usuarios/*`,
`app/api/admin/*`.
**Depends on:** 4 (reuses its list/form pattern).

### Step 6 — Caching + invalidation on write *(**Opus**)*
**Does:** decides and implements the caching strategy for this Next version
(`ARCHITECTURE.md` §8) — read `node_modules/next/dist/docs/` first, do not
assume `unstable_cache` / `revalidatePath` / `revalidateTag` still exist under
those names or behave as before. An editor who publishes a job must see it live
immediately; the 8-connection pool must not be hit per request.
**Touches:** `lib/db/queries.ts`, `app/api/admin/*` (invalidation calls),
route-segment `revalidate` exports.
**Depends on:** 4 (needs real writes to invalidate from).

### Step 7 — Approval workflow *(Sonnet)*
**Does:** `/publicar` creates a `pending` job **and** fires the existing lead
fan-out unchanged; admin queue approve → `published` (sets `published_at`),
reject → with `rejection_reason`, archive; `featured_until` set from the job
edit screen after a manual WhatsApp sale; `activity_log` row written on every
approve/reject/publish/feature/delete.
**Touches:** `app/publicar/*`, `app/admin/empleos/*`, `app/api/admin/*`,
`lib/db/queries.ts`.
**Depends on:** 6.

### Step 8 — Applications inbox *(Sonnet — see open question 3)*
**Does:** insert an `applications` row from the application form **before** the
webhook fan-out (a DB failure must never fail the user's submission);
`/admin/postulaciones` filtered by job with reviewed/contacted/discarded;
applicant count per job in `/admin/empleos`.
**Touches:** `app/api/v1/leads/route.ts` (insert only — the fan-out itself is
untouched), `app/admin/postulaciones/*`.
**Depends on:** 7.

### Step 9 — Abuse hardening on public writes *(Sonnet)*
**Does:** honeypot field + IP rate limit on `POST /api/v1/leads` and on the
`/publicar` submission path. Rejections are silent 2xx to the bot, logged
server-side.
**Touches:** `app/api/v1/leads/route.ts`, `lib/leads.ts` (guard only),
`app/publicar/*`.
**Depends on:** 8.

### Step 10 — Production DB provisioning + cutover *(Sonnet + owner ops — ⛔ NO AUTO-MERGE)*
**Does:** follows `MIGRATION.md` — provision MySQL on Hostinger, set
`DATABASE_URL` / `DATA_SOURCE=db` / `SESSION_SECRET` in hPanel, run migrations
and the seed import **from a local machine, not Hostinger SSH**, redeploy,
verify. Code side is `.env.example` and doc updates only.
**Touches:** `.env.example`, `DEPLOY.md`, `MIGRATION.md` + live hPanel config.
**Depends on:** 9, and on the team having entered real listings via `/admin`.
**Why it stops for the owner:** it is the flip that makes production read from
MySQL, and it sits on top of the credential traps in `nextjs-deploy-hostinger`
§6a — above all, **changing the MySQL password to enable remote access breaks
the live app silently** unless hPanel's `DATABASE_URL` is updated *and* the app
redeployed. Check hPanel's existing value *before* changing any password.

### Step 11 — Retire WordPress *(Sonnet — ⛔ NO AUTO-MERGE)*
**Does:** deletes `lib/wp.ts`, `WP_API_URL`, `USE_WP_BACKEND`, and collapses
`lib/data.ts` to `seed | db`; retires `lib/seed/*.json` from the read path
(keeps the files as import fixtures); decommissions `panel.trabajo.com.py`.
**Touches:** `lib/data.ts`, `lib/wp.ts` (deleted), `.env.example`, docs.
**Depends on:** 10 verified green in production for at least a few days.
**Why it stops for the owner:** it removes the rollback path. Until this
merges, reverting a bad cutover is a one-line env change in hPanel.

### Step 12 — Launch SEO hardening *(Sonnet)*
**Does:** `noindex` on empty category/city combinations (avoids thin pages),
breadcrumbs + `BreadcrumbList` JSON-LD, internal linking pass, Rich Results
check on a live job, sitemap resubmission.
**Touches:** `app/trabajo/*`, `app/empleos/*`, `app/sitemap.ts`.
**Depends on:** 11.

---

## 7. PR batching for autonomous sessions

Each batch is one Claude Code session that opens **and merges** its PRs
**sequentially** — create PR → CI green → merge → pull `main` → next PR. Never
open all of a batch's PRs at once and merge them together: each merge is a
production deploy, and a batch's later steps build on the merged state of the
earlier ones.

| Batch | Steps | Model | Auto-merge |
|---|---|---|---|
| **1** | 1 → 2 | Opus | ✅ yes |
| **2** | 3 → 4 → 5 | Sonnet | ✅ yes |
| **3** | 6 | Opus | ✅ yes |
| **4** | 7 → 8 → 9 | Sonnet | ✅ yes |
| **5** | 10 → 11 | Sonnet | ⛔ **NO — owner review required on both** |
| **6** | 12 | Sonnet | ✅ yes |

Batch 1 runs on Opus because step 2 is the security core; step 1 rides along
because it is small and must precede it. Batch 3 is a single-step Opus batch by
design — the caching decision wants a fresh session that has just read the
Next 16 docs.

**Batch 5 is the hard stop.** It touches live infrastructure: production env
vars, the real database, and the removal of the rollback path. The session
prepares the PRs, posts the verification output, and waits for the owner.

Standing guardrails for every batch:

- Run `npm install && npm run build` locally before **every** push. Merging to
  `main` deploys to production; there is no staging.
- **Never modify `drizzle.config.ts`, `lib/db/index.ts`, or any
  `DATABASE_URL` handling** unless the step explicitly says so (only step 10
  does, and it stops for review). If a task seems to require it, stop and ask.
- Never commit a real `.env`. `.env.example` documents vars; hPanel holds
  values.
- Public reads go through `visiblePredicate()`. Authorization is re-checked
  server-side in every mutating handler. UI copy is Spanish (Paraguay).

---

## 8. Estimate

Batch 1 (Opus) ≈ one session. Batch 2 is the biggest chunk of UI work — one
full Sonnet session. Batch 3 is short. Batch 4 one session. Batch 5 is mostly
owner ops. Batch 6 short.

**≈5 build sessions**, two of them Opus, plus the content operation of entering
real listings — which is the actual critical path to launch, not code.

---

## 9. Reusable across the portfolio

Three patterns here are worth lifting into skills rather than re-deriving:

- The **data seam** (`lib/data.ts`) — a swappable backend behind one module is
  what turned this migration into a config change instead of a rewrite.
- The **lead-routing spec** (`lib/leads.ts` + `app/api/v1/leads/route.ts`):
  zod-validated orchestrator, flat snake_case payload, parallel fan-out with
  backoff, `sendBeacon` leave-page safety, graceful degradation.
- The **status + approval + activity_log** pattern from `ARCHITECTURE.md` §4/§6
  — the same shape any listings or directory site needs.
