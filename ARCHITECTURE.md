# ARCHITECTURE.md — trabajo.com.py custom backend

> Target design for replacing WordPress + JetEngine with a first-party
> Node/MySQL backend inside this repo. Written for build agents.
> Companion docs: `PLAN.md` (phases + model tiering), `MIGRATION.md` (cutover),
> `DEPLOY.md` (Hostinger specifics).

Docs are in English (agent-facing). **All user-visible UI copy stays Spanish
(Paraguay)** — including the admin panel, which the curation team uses daily.

---

## 1. Why custom, and what stays

WordPress at `panel.trabajo.com.py` was only ever a headless data source behind
a switch, and that switch has never been on in production: `.env.example` ships
`USE_WP_BACKEND=false`, so the live site serves `lib/seed/jobs.json`. The jobs
in the WP panel are placeholders. **There is no data to migrate**, which is why
this swap is cheap now and gets more expensive with every real listing.

What does *not* change:

- Every page, component and public API route. They import from `lib/data.ts`
  and never from a data source directly. That seam is the whole reason this is
  a drop-in.
- The `Job` / `Category` / `City` / `JobFilters` types in `lib/types.ts`. The DB
  schema below is designed to map onto them exactly.
- Every public URL — `/empleos/[slug]`, `/trabajo/[categoria]/[ciudad]`,
  sitemap entries. Slugs are carried over from `lib/seed/*.json` verbatim, so
  no redirects and no SEO loss.
- `lib/leads.ts` and its GHL / Sheets fan-out (see §7).

What gets deleted at cutover: `lib/wp.ts`, `WP_API_URL`, `USE_WP_BACKEND`.

---

## 2. Stack

| Concern | Choice | Note |
|---|---|---|
| Runtime | Next.js 16 App Router (already here) | **Read `node_modules/next/dist/docs/` before writing code — this version's APIs differ from training data (`AGENTS.md`).** |
| DB | Hostinger MySQL | Same account as the app, no extra service |
| ORM | Drizzle (`drizzle-orm/mysql2`) + `drizzle-kit` | Matches propia |
| Scripts | `tsx` under `scripts/` | `tsx` does **not** auto-load `.env` — see `DEPLOY.md` |
| Auth | `iron-session` cookie + `bcrypt` hashes | No OAuth needed; fewer moving parts on Hostinger |
| Validation | `zod` (already a dependency) | Reuse for admin forms and API input |

---

## 3. The seam, extended

`lib/data.ts` currently branches seed ↔ WP on one boolean. Replace that with a
three-valued source switch so the DB path can be built and verified *before*
anything is cut over:

```
DATA_SOURCE = seed | db        (wp accepted until cutover, then removed)
```

```
pages / components / API routes
         ↓
      lib/data.ts          ← THE ONLY ENTRY POINT (unchanged signatures)
         ↓
  seed → lib/seed/*.json
  db   → lib/db/queries.ts → Drizzle → MySQL
  wp   → lib/wp.ts (deleted at cutover)
```

Compatibility rule for the transition: if `DATA_SOURCE` is unset, fall back to
the old `USE_WP_BACKEND` behaviour, so a half-finished deploy can never
accidentally serve an empty database.

`lib/db/queries.ts` must implement exactly these eight functions with identical
signatures and semantics to the seed implementations in `lib/data.ts`:

`getJobs` · `getJob` · `getFeaturedJobs` · `getRecentJobs` · `getCategories`
· `getCities` · `getCategory` · `getCity`

Semantics that are easy to get wrong and must be preserved:

- Page size is **20** (`PAGE_SIZE` in both `lib/data.ts` and `lib/wp.ts`).
- Featured = `featured_until > NOW()`, and featured jobs float to the top of
  every sort order except `salario`.
- `salarioMin` filter excludes jobs with `salary_hidden = true` or a null
  `salary_min` — it does not treat them as zero.
- `q` searches title + company + description, case-insensitive.
- `getCategories()` / `getCities()` return a `jobCount` per row. In SQL this is
  a `LEFT JOIN … GROUP BY` over **published, non-expired** jobs only — not a
  count of all rows.

---

## 4. Schema

MySQL, snake_case columns, `utf8mb4_unicode_ci`. All timestamps UTC
(`timezone: "Z"` on the pool).

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `email` | varchar(320) UNIQUE | lowercased before insert |
| `password_hash` | varchar(255) | bcrypt, cost 12 |
| `name` | varchar(200) | |
| `role` | enum(`admin`,`editor`,`employer`) | **no default — always explicit** |
| `company_id` | int NULL → `companies.id` | set for `employer` only |
| `is_active` | boolean default true | soft disable without deleting audit trail |
| `last_login_at` | datetime NULL | |
| `created_at` / `updated_at` | datetime | |

`employer` exists in the enum from day one even though Phase C ships
admin/editor only — adding a role later means retrofitting every permission
check.

### `companies`
`id` · `name` · `slug` UNIQUE · `logo_url` NULL · `whatsapp` NULL ·
`website` NULL · `description` NULL · `owner_user_id` NULL → `users.id` ·
`created_at` · `updated_at`

Today `Job.company` is a plain string and `Job.companyLogo` a path. Both are
resolved by joining `companies` — the seed importer creates one company row per
distinct company name.

### `categories` / `cities`
`id` · `slug` UNIQUE · `name` · `sort_order` int default 0 · `created_at`

Seeded from `lib/seed/categories.json` and `lib/seed/cities.json`. **Slugs are
load-bearing SEO URLs — never rename one without a 301.**

### `jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `slug` | varchar(200) UNIQUE | generated from title, collision-suffixed |
| `title` | varchar(255) | |
| `company_id` | int → `companies.id` | |
| `category_id` | int → `categories.id` | |
| `city_id` | int → `cities.id` | |
| `contract_type` | enum | exact values from `lib/types.ts` |
| `seniority` | enum | exact values from `lib/types.ts` |
| `modality` | enum | exact values from `lib/types.ts` |
| `salary_min` / `salary_max` | int NULL | Guaraníes |
| `salary_hidden` | boolean default false | |
| `description` | text | markdown, rendered by `MarkdownContent` |
| `whatsapp` | varchar(20) NULL | E.164 without `+` |
| `status` | enum(`draft`,`pending`,`published`,`rejected`,`archived`) default `draft` | |
| `featured_until` | datetime NULL | set manually after a WhatsApp sale |
| `published_at` | datetime NULL | → `Job.postedAt` |
| `expires_at` | datetime NULL | listings go stale; see §6 |
| `rejection_reason` | text NULL | shown to the employer later |
| `created_by` / `updated_by` | int NULL → `users.id` | |
| `created_at` / `updated_at` | datetime | `updated_at` → `Job.updatedAt` |

Indexes: `(status, published_at)`, `(status, category_id, city_id)`,
`(status, featured_until)`, `slug` unique.

**Public visibility is one predicate, defined once and reused everywhere:**

```
status = 'published' AND (expires_at IS NULL OR expires_at > NOW())
```

Put it in a single exported helper in `lib/db/queries.ts`. A page that forgets
it leaks unapproved drafts — that is the single highest-risk bug in this
migration, and it belongs in the parity tests.

### `applications`
`id` · `job_id` → `jobs.id` · `candidate_id` NULL → `candidates.id` ·
`consent_id` NULL → `consents.id` · `cv_id` NULL → `candidate_cvs.id` ·
`name` NULL · `phone` NULL · `email` NULL · `message` text NULL ·
`source_page` NULL · `status`
enum(`new`,`reviewed`,`contacted`,`discarded`,`hired`) default `new` ·
`redacted_at` NULL · `status_changed_at` NULL · `status_changed_by` NULL ·
`created_at`

Indexes `(job_id, created_at)`, `(candidate_id, created_at)`. `candidate_id`
stays NULL forever for the anonymous lead-form path — a visitor who never
makes an account must keep being able to apply. The personal fields (`name`,
`phone`, `email`, `message`) are nullable because redaction empties them in
place: `redacted_at` is set when a candidate withdraws consent or deletes
their account, and the row survives as a non-personal husk so the employer's
history and the admin statistics stay coherent.

### `candidates`
`id` · `email` UNIQUE · `password_hash` (bcrypt, cost 12) · `name` · `phone` ·
`city_id` NULL → `cities.id` · `headline` NULL (self-written, never
platform-generated) · `is_active` bool default true · `email_verified_at` NULL ·
`last_login_at` NULL · `created_at` · `updated_at`

Deliberately not a fourth `users.role` — a separate table makes "candidate
reaches `/admin`" structurally impossible instead of conditionally absent.

### `candidate_cvs`
`id` · `candidate_id` → `candidates.id` · `storage_key` (opaque
`cv/{candidateId}/{uuid}.{ext}`, never the user's filename) ·
`original_filename` · `mime_type` · `size_bytes` · `is_current` bool default
true · `uploaded_at` · `deleted_at` NULL

Index `(candidate_id, is_current)`. One row per upload so replacing a CV does
not orphan applications that reference the previous file. `deleted_at` is
purge bookkeeping only — the bytes are gone from storage before this is ever
set, it is not a soft delete.

### `candidate_experiences`
`id` · `candidate_id` → `candidates.id` · `company_name` (free text, never
joined to `companies`) · `title` · `start_month` date · `end_month` date NULL ·
`is_current` bool default false · `description` text NULL · `sort_order` int
default 0

Index `(candidate_id, sort_order)`.

### `consents`
`id` · `subject_type` enum(`candidate`,`employer_user`) · `subject_id` ·
`purpose` enum(`profile_storage`,`application_share`,`terms_acceptance`) ·
`granted` bool · `policy_version` · `related_company_id` NULL ·
`related_job_id` NULL · `ip` · `user_agent` · `created_at`

Indexes `(subject_type, subject_id, purpose)`, `(related_company_id)`.
Append-only: never `UPDATE`d, never `DELETE`d while the data it authorises
exists. Withdrawal is a new row with `granted = false`; the current state of a
consent is the latest row for a (subject, purpose, company) triple.

### `data_access_logs`
`id` · `actor_user_id` → `users.id` · `actor_role` · `action`
enum(`list_candidates`,`view_candidate`,`view_cv`,`view_application`,`export`) ·
`subject_type` · `subject_id` · `reason` NULL (mandatory for drill-down
actions, enforced in code) · `ip` · `created_at`

Indexes `(subject_type, subject_id, created_at)`, `(actor_user_id,
created_at)`. Written inside `lib/db/candidates-admin.ts` before the read
returns, never from the UI layer. Not written for an employer reading their
own applications — that access is consented and not logged.

### `deletion_requests`
`id` · `candidate_id` (int, no FK — deliberately survives the candidate row) ·
`email_hash` (sha256 of the lowercased email) · `requested_by`
enum(`candidate`,`admin`) · `actor_user_id` NULL · `requested_at` ·
`executed_at` NULL · `outcome` text NULL

Holds no personal data by construction; the audit trail of ARCO cancellations.

### `employer_invitations`
`id` · `company_id` → `companies.id` · `email` · `token_hash` UNIQUE (sha256 of
a 32-byte random token; the raw token exists only in the invite link) ·
`created_by` → `users.id` · `expires_at` · `accepted_at` NULL · `created_at`

Index `(company_id, created_at)`. There is no self-serve employer signup —
every account is admin-created.

None of the Phase 2 tables use MySQL `FOREIGN KEY` constraints, matching the
original seven — every scoping/ownership check lives in the query, and the
ARCO purge deliberately keeps `consents` and `deletion_requests` rows pointing
at a candidate id that no longer exists.

### `activity_log`
`id` · `actor_user_id` NULL · `entity_type` · `entity_id` · `action` ·
`meta` json NULL · `created_at`

Written on approve / reject / publish / feature / delete. Cheap now, expensive
to retrofit once there's a billing dispute about a featured listing.

---

## 5. Auth & authorization

- **Session**: `iron-session` encrypted cookie holding **only `userId`**. Load
  the user (and therefore the role) from the DB on each request. Storing the
  role in the cookie means a demoted or disabled user keeps their access until
  the cookie expires.
- **Passwords**: bcrypt cost 12. No password reset flow in v1 — admin resets
  via a `scripts/set-password.ts` one-off. Add self-serve reset with employer
  accounts, not before.
- **Every mutating server action / route handler starts with an authorization
  check**, not just a hidden button:

```ts
const session = await requireSession();
requireRole(session, ['admin', 'editor']);
```

- **Scoped access**: when `employer` accounts land, every query is filtered by
  `company_id = session.user.companyId` unless the role is `admin`. Never
  filter on the client.
- Admin lives under `/admin/*` and must be `noindex` + excluded from
  `sitemap.ts` and `robots.ts`.
- Rate-limit the login route and `/api/v1/leads` (honeypot already planned in
  the old Phase 4).

**Three audiences, three separate cookies, three separate session lookups —
not one role system:**

| Audience | Table | Cookie | Route tree | Guard |
|---|---|---|---|---|
| admin / editor | `users` | `trabajo_session` | `/admin/*` | `requireSessionWithRole(['admin','editor'])` |
| employer | `users` (role `employer`, `company_id` set) | `trabajo_session` (same cookie) | `/empresa/*` | `requireCompanyScope()` in `lib/auth.ts` |
| candidate | `candidates` | `trabajo_postulante` (own cookie) | `/postulante/*` | `requireCandidate()` in `lib/auth-candidate.ts` |

`requireCompanyScope()` returns `{ user, companyId }` or throws: it rejects a
non-`employer` role and rejects an `employer` whose `company_id` is NULL — a
misconfigured account fails closed rather than seeing everything.

The candidate session has its own rate limiter and its own bcrypt cost-12
hashing in `lib/auth-candidate.ts`. A candidate session can never satisfy a
`users`-based guard because it resolves against a different table entirely —
there is no "candidate escalates to admin" code path to reason about.

Next 16 caveat: cookie and request APIs in this version may be async and may
differ from what you remember. **Read the docs in `node_modules/next/dist/docs/`
before writing session code** — do not port an App Router auth snippet from
memory.

---

## 6. Job lifecycle

```
draft ──submit──> pending ──approve──> published ──expires_at passes──> (hidden)
                     │                      │
                     └──reject──> rejected  └──archive──> archived
```

- Team-created jobs may go `draft → published` directly (an `editor` publishing
  their own curated listing needs no second approval in v1).
- `/publicar` submissions create a `pending` job **and** fire the existing lead
  fan-out, so the sales conversation starts on WhatsApp immediately while the
  post waits for review.
- Expiry is a query predicate, not a cron job. Nothing needs to run on a
  schedule for a job to stop showing.
- Featured is likewise just `featured_until > NOW()` — the existing
  `isFeatured()` logic and the badge already work this way.

---

## 7. Leads

`lib/leads.ts` and `POST /api/v1/leads` are complete and working
(zod-validated, `201` first then `after()` fan-out, 3× backoff retries per
destination, graceful skip on empty env vars). **Do not rewrite them.**

The change is additive: the DB becomes the system of record, and the existing
webhook fan-out continues untouched.

1. Insert the lead row (application → `applications`; employer post →
   `pending` job + `activity_log`).
2. Then fan out exactly as today to `GHL_WEBHOOK_URL` and
   `GOOGLE_SHEETS_WEBHOOK_URL`.
3. A logger failure must still never fail the user's submission.

**VenderCRM is available as an optional third destination**, gated on
`VENDERCRM_API_KEY` being set — same pattern as the existing sinks, but it is
not a plain webhook: it needs `X-Api-Key`, a required `phone`, and a stable
`idempotency_key` (`sha256(phone + "|" + YYYY-MM-DD-HH)`) or double-clicks
create duplicate contacts. Follow the `vendercrm-lead-capture` skill exactly if
this is switched on. Whether VenderCRM replaces GHL or runs alongside it is an
open question in `PLAN.md` — the design supports either without rework.

---

## 8. Caching

The WP path used ISR (`next: { revalidate: 300 }`) on every fetch. A local DB
query has no `fetch` to attach that to, so caching must be reconsidered rather
than copied:

- Job listings and taxonomy counts are read-heavy and change rarely → cache
  them, and invalidate on write from the admin panel rather than waiting out a
  timer. An editor who publishes a job expects to see it immediately.
- **Do not assume `unstable_cache`, `revalidatePath`, or `revalidateTag` behave
  as they did in earlier versions, or that they still exist under those names.**
  Check `node_modules/next/dist/docs/` for this version's caching primitives
  first. This is the one place in the migration flagged for an Opus checkpoint
  in `PLAN.md`.
- The MySQL pool uses a small `connectionLimit` (8) — Hostinger caps concurrent
  connections per user, and an uncached per-request query storm will hit it.

### Decision (step 6, implemented)

Verified against `node_modules/next/dist/docs/` for Next 16.2.9:

- Next 16 ships **two** caching models. `use cache` / `cacheTag` / `cacheLife`
  exist only under `cacheComponents: true`. This app does not enable it —
  that flag is a whole-app migration (PPR, `<Suspense>` around every
  runtime-API read) and `next.config.ts` is outside step 6's scope. So the
  "previous model" applies: `unstable_cache` + `revalidateTag` +
  `revalidatePath`. `unstable_cache` is documented as replaced by `use cache`,
  but is still exported and functional.
- `revalidateTag` now takes a **mandatory second argument**. `'max'` means
  stale-while-revalidate, which is wrong here — an editor must not see the old
  listing, and a deleted job must not keep being served. Route Handlers use
  `revalidateTag(tag, { expire: 0 })`, the documented immediate-expiry form.
  `updateTag` would be idiomatic but is Server-Actions-only, and every admin
  mutation here is a Route Handler.
- Two coarse tags (`public-jobs`, `public-taxonomies`) plus the public route
  paths, fired together by `invalidatePublicContent()` in `lib/cache.ts` from
  every mutating handler under `app/api/admin/*`. Over-invalidating costs a
  query; under-invalidating serves an unapproved listing.
- The eight seam functions in `lib/db/queries.ts` are wrapped in
  `unstable_cache`; the raw SQL is private, so an uncached public read path
  cannot be added by accident.
- Route-segment `revalidate` went from 30–60s to **300s** (sitemap stays 1h).
  It is no longer the freshness mechanism — only the bound on the two
  transitions with no write to hook onto: `expires_at` passing and
  `featured_until` lapsing (§6).

---

## 9. Routes added

```
/admin                        Dashboard (pending queue count, recent activity)
/admin/login                  Email + password
/admin/empleos                Job list: filter by status, search
/admin/empleos/nuevo          Create
/admin/empleos/[id]           Edit + approve / reject / publish / feature
/admin/empresas               Company CRUD
/admin/postulaciones          Applications inbox (Phase E)
/admin/usuarios               User CRUD (admin role only)
/api/admin/*                  Mutations — all role-checked server-side

/empresa                      Employer dashboard
/empresa/login                Employer login (shares authenticate() + rate limiter)
/empresa/activar              Invitation acceptance: set password + terms consent
/empresa/empleos              Company's own job list
/empresa/postulaciones        Applications to the company's jobs
/api/empresa/*                Mutations and reads — requireCompanyScope() first
/api/empresa/cv/[applicationId]  Authorized CV download, keyed on the application

/postulante                   Candidate dashboard
/postulante/login              Candidate login
/postulante/registro           Candidate signup (blocking profile_storage consent)
/postulante/perfil             Profile + experience + CV upload
/postulante/mis-postulaciones  Application history, consent withdrawal
/api/postulante/*              Mutations and reads — requireCandidate() first
/api/postulante/cv/[id]        Authorized CV download, owned by the candidate
```

Both `/empresa/*` and `/postulante/*` are `noindex`, excluded from
`sitemap.ts` and `robots.ts` (same discipline as `/admin/*`), and gated behind
`EMPLOYER_DASHBOARD_ENABLED` and `CANDIDATE_ACCOUNTS_ENABLED` respectively.

Public routes are unchanged.
