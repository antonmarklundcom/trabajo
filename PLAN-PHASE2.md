# PLAN-PHASE2.md — employer dashboard + job seeker profiles

> **Written 2026-08-09 by Opus 5. Planning only — no code in this document.**
> `PLAN.md` covers the WordPress → MySQL rebuild (steps 1–12, all merged). This
> document is the next body of work and assumes that state: MySQL is the data
> source, `/admin` exists, `lib/auth.ts` is live, caching is decided.
>
> Read `AGENTS.md` first. **This repo runs Next.js 16** — APIs differ from
> training data, so every session consults `node_modules/next/dist/docs/`
> before writing session, upload, cache or route code.
>
> Companion docs: `ARCHITECTURE.md` (current backend design), `DEPLOY.md`
> (Hostinger + MySQL traps), `MIGRATION.md` (historical cutover).

---

## 0. What this adds, in one paragraph

Companies get a login (`employer` role, already in the schema and never
implemented) and see **only their own postings and only the applications
submitted against those postings**. Candidates get an account with a CV and
work history so they can apply with one click instead of retyping the lead
form; profiles are **private by default and visible only to the employers they
actually applied to**. The super admin gets aggregate statistics plus a
deliberately narrow, fully logged path to individual candidate data for
moderation and support. Nothing in this plan searches, ranks, scores, matches
or recommends candidates — that is Phase 4 and it is explicitly not now.

### The legal frame is a design constraint, not a footnote

From the two research passes summarised in the brief, treated here as hard
requirements:

- The platform is a **job-advertising and applicant-management software
  product**, never an "agencia de empleo". Nothing we build may imply we
  select, vet, screen, verify, rank or place candidates.
- Ley N° 7593/2025 (Paraguay's GDPR-equivalent) applies the moment we store a
  CV. That means: explicit opt-in before storing a profile, a **separate**
  explicit consent before data reaches a **named** employer, purpose
  limitation, a stated retention period, and working ARCO rights — access,
  rectification, cancellation, opposition — where "cancellation" is a real
  purge, not a flag.
- The super admin's "see all candidates" power is the sharpest edge in this
  plan. It is legitimate (moderation, support, abuse, aggregate reporting) and
  it is also exactly the capability that, exposed to employers or exportable
  in bulk, would turn the product into a talent database. It gets its own
  table, its own reason-required UI and its own paragraph in the privacy
  policy.

Two consequences the schema and the PR order below are built around: **admin
never reuses employer-scoped query functions** (no `if (admin) skip the
filter` branch anywhere), and **candidates are a separate auth surface from
`/admin`** (different table, different cookie, different guard).

---

## 1. Schema design

One migration in PR 1 creates everything Phases 1–3 need. A single migration
is deliberate: `drizzle-kit generate` is cheap, but on a repo where merging to
`main` is a production deploy with no staging, three separate schema deploys
are three chances to run a migration against a live DB in the wrong order.

### 1.1 Changes to existing tables

| Table | Change | Why / migration note |
|---|---|---|
| `applications` | add `candidate_id` int NULL → `candidates.id` | Links an application to a profile. NULL = anonymous lead-form application, which stays supported forever. |
| `applications` | add `consent_id` int NULL → `consents.id` | The specific per-employer consent record that authorised this share. NULL for legacy/anonymous rows. |
| `applications` | add `cv_id` int NULL → `candidate_cvs.id` | Which CV was shared. Not a copy — a reference, so deletion actually deletes. |
| `applications` | add `redacted_at` datetime NULL | Set when personal data is purged; row survives as a non-personal husk (see §4.4). |
| `applications` | add `status_changed_at` datetime NULL, `status_changed_by` int NULL | Needed for any funnel/conversion metric. Without it, §5's conversion numbers are unmeasurable. |
| `applications` | extend `status` enum with `hired` | `new,reviewed,contacted,discarded,hired`. MySQL enum extension is an in-place `ALTER`; safe, but it is a schema change so it belongs in PR 1, not bolted on in PR 13. Depends on open question Q3. |
| `applications` | new index `(candidate_id, created_at)` | Candidate's "mis postulaciones" list. |
| `jobs` | new index `(company_id, status, created_at)` | Every employer-scoped job list hits this. Existing indexes all lead with `status`, which is the wrong prefix for company scoping. |
| `users` | no column changes | `role` already has `employer`, `company_id` already exists. This is the payoff of designing it in on day one. |
| `companies` | no column changes | `whatsapp`, `website`, `description`, `logo_url`, `owner_user_id` all exist. |

Nothing above rewrites or backfills existing rows, so `drizzle-kit generate`
plus `npm run db:migrate` is the whole strategy. The one thing to verify by
hand: MySQL enum alteration on a non-empty `applications` table — extend, never
reorder, and never rename an existing value.

### 1.2 New tables

**`candidates`** — the job seeker account. Deliberately *not* a row in `users`.

`id` · `email` varchar(320) UNIQUE · `password_hash` · `name` · `phone`
varchar(20) · `city_id` NULL → `cities.id` · `headline` varchar(200) NULL
("Vendedor con 3 años de experiencia" — self-written, never platform-generated)
· `is_active` bool · `email_verified_at` NULL · `last_login_at` NULL ·
`created_at` · `updated_at`

Why a separate table rather than `users.role = 'candidate'`: every existing
guard, every admin list query and every `requireRole` call is written against
`users`. Adding a fourth role means auditing all of them, and the failure mode
of missing one is a candidate reaching `/admin`. A separate table makes that
class of bug structurally impossible instead of conditionally absent. The cost
is a second session implementation, which PR 2 pays once.

**`candidate_cvs`** — uploaded files, one row per upload.

`id` · `candidate_id` → `candidates.id` · `storage_key` varchar(255) (opaque
UUID key, never the user's filename) · `original_filename` varchar(255) ·
`mime_type` · `size_bytes` · `is_current` bool · `uploaded_at` · `deleted_at`
NULL

Multiple rows so replacing a CV does not orphan applications that referenced
the old one. `deleted_at` here is bookkeeping for the purge job, **not** a soft
delete of the file: the bytes are gone before that column is set (§4.4).

**`candidate_experiences`** — work history.

`id` · `candidate_id` · `company_name` varchar(200) (free text; never joined to
`companies` — a candidate's past employer is not a platform tenant) · `title` ·
`start_month` date · `end_month` date NULL · `is_current` bool · `description`
text NULL · `sort_order` int

**`consents`** — append-only consent ledger. Never updated, never deleted while
the underlying data exists.

`id` · `subject_type` enum(`candidate`,`employer_user`) · `subject_id` ·
`purpose` enum(`profile_storage`,`application_share`,`terms_acceptance`) ·
`granted` bool · `policy_version` varchar(20) · `related_company_id` NULL ·
`related_job_id` NULL · `ip` varchar(45) · `user_agent` varchar(255) ·
`created_at`

Withdrawal is a **new row with `granted = false`**, not an edit. The current
state of a consent is the latest row for that (subject, purpose, company)
triple. This is what makes "prove the candidate agreed, on this date, to this
policy version, for this employer" answerable a year later.

**`data_access_logs`** — who looked at whose personal data.

`id` · `actor_user_id` → `users.id` · `actor_role` · `action`
enum(`list_candidates`,`view_candidate`,`view_cv`,`view_application`,`export`)
· `subject_type` · `subject_id` · `reason` varchar(255) NULL ·
`ip` · `created_at`

Written by admin candidate reads and by any CV download. Never written from the
UI layer — see the "impossible to bypass" construction in §2.4. Not written for
an employer reading their own applications (that is the data they were
consented to receive; logging it would be noise that hides the signal). Index
`(subject_type, subject_id, created_at)` so "who has seen my data" is a cheap
query if a candidate ever asks.

**`deletion_requests`** — the audit trail of ARCO cancellations.

`id` · `candidate_id` (int, kept after the candidate row is gone — deliberately
not an FK) · `email_hash` varchar(64) (sha256, so a re-signup can be correlated
without storing the address) · `requested_at` · `executed_at` NULL ·
`requested_by` enum(`candidate`,`admin`) · `actor_user_id` NULL · `outcome`
text NULL

No FK on `candidate_id` on purpose: the whole point is that this row outlives
the candidate. It stores no personal data.

**`employer_invitations`** — how an employer account comes into existence.

`id` · `company_id` → `companies.id` · `email` · `token_hash` varchar(64)
(sha256 of a 32-byte random token; the raw token exists only in the invite
link) · `created_by` → `users.id` · `expires_at` · `accepted_at` NULL ·
`created_at`

Assumes employer accounts are **admin-created**, matching how admin/editor
accounts work today (open question Q2).

### 1.3 What is deliberately NOT in the schema

No `candidate_skills` / tags table, no full-text index on CVs, no
`candidate_visibility` flag, no `saved_candidates`. Each of those is only
useful for browsing or matching, and each would make "we don't operate a talent
database" a harder claim to defend. They are Phase 4, gated on legal review.

---

## 2. Auth & scoping model

### 2.1 Three audiences, two cookies

| Audience | Table | Cookie | Route tree | Guard |
|---|---|---|---|---|
| admin / editor | `users` | `trabajo_session` (existing) | `/admin/*` | `requireSessionWithRole(['admin','editor'])` (exists) |
| employer | `users` (role `employer`, `company_id` set) | `trabajo_session` (same) | `/empresa/*` | `requireCompanyScope()` (new) |
| candidate | `candidates` | `trabajo_postulante` (new) | `/postulante/*` | `requireCandidate()` (new) |

Employers share the staff cookie because they share the `users` table and the
existing `getSessionUser()` already returns `role` and `companyId` from the DB
per request. What must change is that `/admin`'s layout guard currently allows
any authenticated user through to `/admin` on the wrong-role redirect path — an
`employer` must land on `/empresa`, never inside `/admin`. That redirect target
is role-dependent and is part of PR 2.

Candidates get their own cookie and their own module. A candidate session can
never satisfy a `users`-based guard because it resolves against a different
table, so there is no "candidate escalates to admin" path to reason about.

### 2.2 Employer login, end to end

1. Admin creates a company (exists) and issues an invitation from
   `/admin/empresas/[id]` → `employer_invitations` row, invite URL returned
   once and shown once.
2. The invitee opens `/empresa/activar?token=…`. The handler hashes the token,
   looks it up unexpired and unaccepted, and shows a set-password form plus the
   **terms acceptance checkbox** (writes a `consents` row,
   `purpose = terms_acceptance`, with the policy version).
3. On submit: create the `users` row with `role='employer'` and
   `company_id = invitation.company_id`, bcrypt cost 12, mark the invitation
   accepted, create the session, redirect to `/empresa`.
4. Login afterwards reuses the existing `/admin/login` form logic but at
   `/empresa/login`, sharing `authenticate()` and the existing IP+email rate
   limiter.

No self-serve employer signup. An account is a relationship to a `company_id`
that someone at the platform has to vouch for; self-serve would let anyone
claim a company and read its applications.

### 2.3 How `company_id` scoping is actually enforced

The rule from `AGENTS.md` — authorization is checked server-side in every
mutating handler, hiding a button is UX — is necessary but not sufficient here,
because the risk is a *read* returning another company's applicants. The
construction:

- A new module `lib/db/employer.ts`. **Every exported function takes
  `companyId: number` as its first parameter and every query includes it in the
  `WHERE`.** No function in this file reads the session, and no function
  accepts `companyId: number | null` or `'all'`.
- There is **no admin branch inside these functions**. Admin oversight uses
  `lib/db/admin.ts` (exists) and, for candidate data, `lib/db/candidates-admin.ts`
  (PR 12). A reviewer can therefore verify scoping by reading one file and
  checking that every query mentions `companyId` — a property that is
  mechanically checkable rather than a judgement call.
- `requireCompanyScope()` in `lib/auth.ts` returns `{ user, companyId }` or
  throws: it rejects a non-`employer` role and rejects an `employer` whose
  `company_id` is NULL (a misconfigured account must fail closed, not see
  everything).
- Every handler under `/api/empresa/*` starts with it, and every mutation
  re-verifies ownership of the target row **in the UPDATE's WHERE clause**, not
  with a preceding SELECT: `UPDATE applications … WHERE id = ? AND job_id IN
  (SELECT id FROM jobs WHERE company_id = ?)`. A check-then-write pair is a
  race; a scoped write is not.
- `scripts/verify-scoping.ts` (PR 3): seeds two companies with jobs and
  applications, then asserts every exported function in `lib/db/employer.ts`
  returns zero rows / zero affected rows when called with the other company's
  id. This is the closest thing to a test suite this repo has, and this is the
  one place that earns it.

### 2.4 The super admin's broader access

Admin reads of candidate data live in `lib/db/candidates-admin.ts` and every
exported function has the shape:

```
listCandidates(actor: SessionUser, filters, reason?) → { rows, … }
viewCandidate(actor: SessionUser, candidateId, reason: string) → profile
```

The logging call happens **inside** these functions, before the return, in the
same transaction-less sequence as the read — not in the page component, not in
the route handler. A caller cannot obtain candidate data from this module
without producing a `data_access_logs` row, because there is no code path that
returns data and skips the write. Functions requiring a `reason` take it as a
non-optional string and reject empty/whitespace.

`role` is checked as exactly `admin` — `editor` does not get candidate access.
That is a narrowing versus today's admin/editor parity, and it is intentional:
the curation team needs jobs, not CVs.

---

## 3. CV / file storage

### 3.1 Where the bytes live

**Recommendation: Cloudflare R2 (S3-compatible), private bucket, no public
access, short-lived presigned GET generated server-side per download.**

The Hostinger-disk alternative is real but worse here:

- The deployed source lives under `public_html/.builds/last-source/`
  (`DEPLOY.md`), which is replaced on every deploy. Anything written inside the
  app directory is destroyed by the next merge to `main` — and merges to `main`
  are frequent and automatic. Uploads would have to go to a path outside the
  build root, which is possible but undocumented, unversioned and easy to lose.
- Nothing on the Hostinger side backs that directory up on our schedule.
- Losing a candidate's CV silently is both a product failure and, arguably, a
  data-integrity failure under the new law.

R2 costs approximately nothing at this volume (free tier covers 10 GB and the
egress is free), and it is a bucket, not a service to operate. **Owner decision
required** (Q4) — if the answer is "no new services", the fallback is a
`CV_STORAGE_DIR` outside the build root with a documented backup step, and the
code supports it:

`lib/storage.ts` exposes `put`, `getSignedUrl`, `getStream`, `delete` behind an
interface with two drivers selected by `CV_STORAGE_DRIVER=r2|disk`. Choosing
later is an env var, not a rewrite. This is the same seam trick that made the
WordPress swap cheap.

### 3.2 Upload rules

- Types: PDF, DOC, DOCX only. Validated by **magic bytes**, not by the
  client-sent `Content-Type` and not by the extension.
- Size: **5 MB** hard limit, enforced server-side before the body is fully
  buffered. Next 16's route body handling differs from older App Router
  material — read the docs, do not port a snippet.
- Filename: never used as a storage key and never echoed into a response
  header unsanitised. Key is `cv/{candidateId}/{uuid}.{ext}`;
  `original_filename` is stored for display only.
- No image/archive types, no zip, nothing executed or rendered by us. We never
  parse CV contents — parsing is the first step down the road to "matching".

### 3.3 Download rules

There is **no public URL for a CV, ever.** Three code paths, each with its own
authorization:

| Path | Who | Check | Logged |
|---|---|---|---|
| `/api/postulante/cv/[id]` | the candidate | `cv.candidate_id === session.candidateId` | no |
| `/api/empresa/cv/[applicationId]` | employer | application's job's `company_id` matches, and the application is not `redacted_at` | no |
| `/api/admin/cv/[id]` | admin only | role `admin` + reason required | **yes**, `view_cv` |

The employer path keys on the **application**, not the CV id: an employer's
right to a CV comes from the application, so the URL should carry that
relationship rather than have the handler reconstruct it.

Signed URLs (R2 driver) are generated per request with a 60-second expiry and
never persisted. On the disk driver the route streams the file itself.

### 3.4 Deletion

`storage.delete()` is called before the DB row is touched, and a failure to
delete the object **fails the request loudly** rather than proceeding to remove
the row that records the object's existence. An orphaned DB row is recoverable;
an orphaned CV with no row pointing at it is a file we cannot find to delete
when the candidate asks again.

---

## 4. Consent & data lifecycle

### 4.1 Consent points

| # | When | Purpose | What is recorded |
|---|---|---|---|
| 1 | Candidate signup | `profile_storage` | Unchecked-by-default checkbox, `policy_version`, IP, UA. Blocking — no account without it. |
| 2 | Each application | `application_share` | Names the employer: "Acepto compartir mi perfil y mi CV con **{empresa}** para esta postulación." `related_company_id` + `related_job_id` recorded. Blocking. |
| 3 | Employer activation | `terms_acceptance` | ToS + the "we are not an agency, you own your hiring process" acknowledgement. |

Consent #2 is per application, not per company, and not once at signup. That is
what makes purpose limitation real: consent exists for the applications it was
given for, and for nothing else.

### 4.2 Withdrawal

A candidate can withdraw consent for a specific application from
`/postulante/mis-postulaciones`. That writes a `granted=false` consent row and
sets `applications.redacted_at`, immediately removing the personal fields from
the employer's view (§4.4). It does not delete the account.

### 4.3 Retention (proposal — owner must confirm, Q1)

| Data | Retention | Trigger |
|---|---|---|
| Candidate profile + CV | **24 months** after last login | Warning at 23 months; purge at 24. |
| Application personal data | **12 months** after the application's job expires or is archived | Redaction, not row deletion. |
| `consents` | 5 years after the consent's data is purged | It is the evidence that the purge was authorised. Holds no CV, no phone. |
| `data_access_logs` | 24 months | |
| `deletion_requests` | indefinite | Holds no personal data by construction. |

Hostinger gives us no cron. The sweep is `npm run db:purge`, dry-run by
default, `--apply` to execute, printing exactly what it would touch. It can be
run manually monthly or driven by a scheduled Claude Routine. Documented in
`DEPLOY.md` alongside the other `db:*` scripts.

### 4.4 Deletion: hard delete, with a non-personal husk

**Decision: hard delete of personal data. Not a soft-delete flag.**

The reasoning: ARCO's *cancelación* means the data stops existing, and a
soft-delete flag leaves it queryable by exactly the actor a candidate is most
likely to be worried about — the platform operator. A flag also fails the
simplest audit question ("show me that it's gone"). And a flag on
`candidates.is_deleted` would have to be honoured by every future query, which
is the same "one missed WHERE clause" risk we removed everywhere else in this
plan.

What "delete my account" executes, in order:

1. Write `deletion_requests` (before anything is destroyed, so an interrupted
   purge is still evidenced).
2. `storage.delete()` every CV object. Hard-fail on error.
3. `DELETE` from `candidate_cvs`, `candidate_experiences`.
4. **Redact** every `applications` row: NULL out `name`, `phone`, `email`,
   `message`, `cv_id`, `candidate_id`; set `redacted_at`. The row itself
   survives carrying only `job_id`, `status`, timestamps.
5. `DELETE` the `candidates` row.
6. Keep `consents` rows (they now reference a candidate id that no longer
   resolves — which is correct: they prove what was authorised, and they carry
   no personal data beyond IP/UA, which ages out with them).
7. Stamp `deletion_requests.executed_at`.

The husk in step 4 is what keeps the employer's inbox and the admin statistics
coherent — "3 postulaciones" does not silently become 2, and the employer sees
"El postulante eliminó sus datos" instead of a row vanishing. It contains no
personal data, so it is not a retention of the candidate's information; it is
the record that an event happened.

Deletion runs synchronously in the request, not on a queue. At this scale it is
a handful of statements and two or three object deletes, and a queue would only
add a way for it to silently not happen.

---

## 5. Statistics for the super admin

### 5.1 What is honestly measurable from the data we collect

| Metric | Source | Notes |
|---|---|---|
| Applications per day / week / month | `applications.created_at` | |
| Applications per job | `applications.job_id` | Also: jobs with **zero** applications, which is the number that actually predicts churn. |
| Applications by category / city | join `jobs → categories/cities` | |
| Application funnel | `status` + `status_changed_at` | new → reviewed → contacted → hired/discarded. Only as honest as employers are diligent about updating status. Report it with that caveat visible in the UI. |
| Conversion to `hired` | same | Depends on Q3. |
| Registered vs anonymous applications | `candidate_id IS NULL` | The single best measure of whether Feature 2 is working. |
| Candidate signups over time, active candidates | `candidates.created_at`, `last_login_at` | |
| Jobs published per period, by company | `jobs.published_at`, `company_id` | |
| Employer activity | last login, jobs posted, applications received, days since last status change | This is the sales/retention view. |
| Time-to-first-application per job | `published_at` → first `created_at` | |
| Featured listings active / lapsing | `featured_until` | Directly useful for manual renewal sales. |

**Not measurable, and we should say so rather than fake it:** job page views,
search impressions, apply-form abandonment. Those live in GA4 and are not in
MySQL. Wiring a `job_views` counter table is a possible later addition;
`ARCHITECTURE.md` §8's cache means a naive per-render counter would be wrong
anyway. Out of scope here.

### 5.2 The surface

**`/admin/estadisticas` — aggregate only. No names, no phones, no CVs, ever.**
Cards for the headline counts, a time series for applications and signups, a
table per category/city, and an employer-activity table. Cached with the
existing `unstable_cache` pattern; these queries are `GROUP BY` scans and must
not run per request against a pool of 8 connections.

**`/admin/postulantes` — the narrow, logged path.** This is the part the brief
correctly flags as the highest-risk piece, so:

- Default view is **aggregate**: counts by city, by signup month, by
  application volume bucket. No contact details in the list.
- The list shows candidate id, city, signup date and application count —
  enough to identify the *right* record when investigating something, not
  enough to be useful as a talent list.
- **No free-text search over CVs or work history.** Lookup is by exact email
  or by candidate id, i.e. you have to already know who you are looking for.
- Opening one profile requires selecting a **reason** from a fixed list
  (`moderación de contenido`, `soporte al postulante`, `denuncia/abuso`,
  `solicitud ARCO`, `otro` + free text) before the data renders. Writes
  `data_access_logs`.
- Viewing or downloading a CV is a second, separately logged action.
- **No bulk export button.** An export endpoint is the single feature that
  would turn this into the thing we told the regulator we are not. If an export
  is ever genuinely needed for an ARCO access request, that is the candidate's
  own export in `/postulante/mis-datos`.
- `/admin/registros-de-acceso` renders `data_access_logs` read-only, so the
  owner can see their own team's access — including their own.

This is the answer to "aggregate-only or drill-down?": **aggregate by default,
drill-down available, reason mandatory, every drill-down logged.**

---

## 6. Phased delivery — 14 PRs, model per PR

The brief's phasing (1 employer, 2 candidates, 3 not-now) is right and is kept.
Adjustments: a foundation batch comes before Phase 1, because the schema,
multi-audience auth and the scoping module are shared by both features and
retrofitting scoping after the employer UI exists means auditing the UI too.
And admin oversight/statistics is pulled out as its own phase, because it
depends on both features existing and it is the piece with the legal edge.

Every PR ends with `npm install && npm run build` passing. Every merge to
`main` is a production deploy. Two feature flags keep unfinished surfaces dark:

```
EMPLOYER_DASHBOARD_ENABLED=false     # /empresa/* returns 404 until flipped
CANDIDATE_ACCOUNTS_ENABLED=false     # /postulante/* returns 404 until flipped
```

The flags are read server-side in the route-tree layouts, not in the client.
They are what makes it safe to merge half-finished features into a repo that
auto-deploys, and they are why the legal copy (PR 6, PR 11) can land *after*
the code but *before* the surface goes live.

### Phase 0 — Foundation (Opus)

| PR | Title | Model | Scope |
|---|---|---|---|
| **1** | Data model & migration | **Opus** | All of §1: new tables, `applications` changes, indexes, one drizzle migration, `db:verify` extended to count the new tables. **No behaviour change, no UI.** |
| **2** | Multi-audience auth core | **Opus** | `requireCompanyScope()`; role-aware post-login redirect; `lib/auth-candidate.ts` (own cookie, own rate limiter, bcrypt 12, DB-per-request lookup); `scripts/create-candidate.ts` for local testing; the two feature flags. No UI. |
| **3** | Employer-scoped data layer | **Opus** | `lib/db/employer.ts` per §2.3 + `scripts/verify-scoping.ts` with its cross-company assertions actually run and pasted into the PR body. No UI. |

*Why Opus for all three:* PR 1 is where the legal model becomes columns — a
missing `redacted_at` or a soft-delete flag chosen here propagates into every
later PR. PR 2 is the same class of work as `PLAN.md` step 2 (session code
against Next 16 APIs that differ from training data), on a repo that
auto-deploys to production. PR 3 is the file whose bug is "company A reads
company B's applicants".

*Complexity:* PR 1 medium (mechanical once designed — the design is above),
PR 2 medium-high, PR 3 medium. One Opus session.

### Phase 1 — Employer dashboard (Sonnet)

| PR | Title | Model | Scope |
|---|---|---|---|
| **4** | Employer dashboard UI | Sonnet | `/empresa` (layout, nav, dashboard counts), `/empresa/login`, `/empresa/empleos` (own jobs, read-only), `/empresa/postulaciones` (own applications, contact details, status change), `/api/empresa/*` handlers. Spanish (PY). `noindex` on the whole tree + excluded from `sitemap.ts`/`robots.ts`. |
| **5** | Employer provisioning + job submission | Sonnet | Invitation issue/accept flow per §2.2; `/admin/empresas/[id]` gains "invitar usuario"; employer creates/edits **own** jobs, always saved as `pending`, never self-published; **slug is not editable by employers at all** (slugs are live SEO URLs — an employer must not be able to trigger a 301 obligation). Reuses the admin job form component. Also implements the material-change rule in §6.1. |
| **6** | Phase-1 legal copy + flag flip | Sonnet | §7 items 1–6. Ends by setting `EMPLOYER_DASHBOARD_ENABLED=true` in hPanel. ⛔ **No auto-merge** — the owner reads the Spanish copy before it is public. |

*Complexity:* PR 4 large (biggest UI chunk in the plan), PR 5 medium, PR 6
small. One Sonnet session, possibly one and a half.

### Phase 2 — Candidate profiles (mixed)

| PR | Title | Model | Scope |
|---|---|---|---|
| **7** | CV storage layer | **Opus** | `lib/storage.ts` + both drivers, magic-byte validation, size limit, the three download routes with their distinct authz (§3.3), delete-fails-loudly semantics. Next 16 upload/stream APIs read from the docs. |
| **8** | Candidate accounts + profile | Sonnet | `/postulante/registro` (consent #1), `/postulante/login`, `/postulante/perfil` (edit, work history CRUD, CV upload/replace). Includes `lib/email.ts` for verification + password reset if Q5 is approved. |
| **9** | One-click apply | Sonnet | Logged-in apply on `/empleos/[slug]` — consent #2 naming the employer, writes `applications` with `candidate_id`/`consent_id`/`cv_id` **and** fires the existing lead fan-out unchanged; `/postulante/mis-postulaciones`; employer inbox renders profile + CV for its own applications. **The anonymous lead form stays exactly as it is** — `lib/leads.ts` and `POST /api/v1/leads` are not rewritten (`ARCHITECTURE.md` §7). |
| **10** | ARCO rights | **Opus** | `/postulante/mis-datos`: self-service export (JSON of everything we hold), rectification (already covered by profile edit — linked from here), per-application consent withdrawal + redaction, account deletion executing §4.4 in order. `npm run db:purge` retention sweep, dry-run default. |
| **11** | Phase-2 legal copy + flag flip | Sonnet | §7 items 7–12. Ends by setting `CANDIDATE_ACCOUNTS_ENABLED=true`. ⛔ **No auto-merge.** |

*Why Opus for 7 and 10:* PR 7 is untrusted file upload plus authorized binary
download — the other place where a mistake is a data breach rather than a bug.
PR 10 is the destructive path; it must be complete (no orphaned objects), it
must be ordered correctly (evidence before destruction), and it must not leave
the statistics or the employer inbox inconsistent. Neither is mechanical work
against an existing spec, which is the line `PLAN.md` §4 draws.

*Complexity:* PR 7 medium, PR 8 large, PR 9 medium, PR 10 medium-high, PR 11
small. Roughly two Sonnet sessions plus two short Opus ones.

### Phase 3 — Admin oversight & statistics (mixed)

| PR | Title | Model | Scope |
|---|---|---|---|
| **12** | Access logging + candidate oversight | **Opus** | `lib/db/candidates-admin.ts` with logging inside every function (§2.4); `/admin/postulantes` aggregate-first with reason-gated drill-down; `/admin/registros-de-acceso`. |
| **13** | `/admin/estadisticas` | Sonnet | §5.1 metrics, aggregate only, cached. Charts can be plain SVG/CSS — no new dependency for six bar charts. |
| **14** | Retention ops + docs | Sonnet | `db:purge` wired into `DEPLOY.md`, upcoming-purge visibility in `/admin`, `ARCHITECTURE.md` updated with the new tables and the two new auth surfaces, `AGENTS.md` non-negotiables extended (see §9). |

*Why Opus for 12:* it is the code that implements the legal promise made in the
privacy policy. The logging must be unbypassable by construction, not by
convention.

### Phase 4 — NOT NOW

Explicitly out of scope and not to be built without written legal review:
searchable/browsable candidate database for employers, any matching, ranking or
scoring, "candidatos recomendados", paid access to candidate data, bulk export,
CV parsing, anything implying we screen or verify anyone. If a PR description
in this project starts sounding like one of those, that is the signal to stop
and ask.

### 6.1 When an employer edit needs re-approval (owner-decided, 2026-08-09)

PR 3 shipped the strict rule: **any** employer edit to a published job returns
it to `pending`. That protects the approval workflow, but it also takes a live
listing offline because someone fixed a typo in a phone number — and the first
employer that happens to will call the team about it.

The rule PR 5 implements instead: **re-approval is required only when the
content that was approved changes.**

| Field | On edit of a published job |
|---|---|
| `title`, `description` | → back to `pending` |
| `salaryMin`, `salaryMax`, `salaryHidden` | → back to `pending` |
| `whatsapp`, and the company-profile fields (logo, website, description) | applied live, stays `published` |
| `categoryId`, `cityId`, `contractType`, `seniority`, `modality` | → back to `pending` — they decide which SEO landings the listing appears on, so a silent change is a silent re-targeting |

Salary is in the strict group deliberately. Changing the advertised salary after
approval is the classic bait-and-switch, and it is exactly the kind of edit a
moderation queue exists to catch — not a formality.

Implementation note: compare the incoming input against the stored row inside
`updateEmployerJob()` in `lib/db/employer.ts` and set `status` accordingly.
Keep it in that function rather than in the route handler — the rule is a
property of the write, and a second caller must not be able to skip it. The
unpublished-job case is unchanged: a `draft`/`pending`/`rejected` job stays
`pending` whatever changed.

### 6.2 Session batching

Same discipline as `PLAN.md` §7: one session per batch, PRs opened and merged
**sequentially** — create PR → CI green → merge → pull `main` → next PR.

| Batch | PRs | Model | Auto-merge |
|---|---|---|---|
| **A** | 1 → 2 → 3 | **Opus** | ✅ |
| **B** | 4 → 5 | Sonnet | ✅ |
| **C** | 6 | Sonnet | ⛔ owner reads the copy |
| **D** | 7 | **Opus** | ✅ |
| **E** | 8 → 9 | Sonnet | ✅ |
| **F** | 10 | **Opus** | ✅ |
| **G** | 11 | Sonnet | ⛔ owner reads the copy |
| **H** | 12 | **Opus** | ✅ |
| **I** | 13 → 14 | Sonnet | ✅ |

Nine sessions, five of them Opus (batches A, D, F, H — A is three PRs, the rest
single-PR by design, because each is a security or privacy core that wants a
fresh session that has just read the Next 16 docs).

**Model tiering rule for this project, stated once:** Opus writes anything
where a subtle mistake leaks personal data, destroys data incompletely, or
grants access across a tenant boundary. Sonnet writes UI, forms, CRUD, copy,
wiring, reporting and docs against the specs above. That is the same rule
`PLAN.md` §4 used; this feature simply has more surface that meets it — six PRs
instead of two, because the whole feature *is* a data-protection surface.

---

## 7. Copy / ToS checklist (Spanish, Paraguay)

Not final copy — the list of what must exist and where, before each flag flips.
Vocabulary rule throughout: **use** "portal de empleos", "gestión de
postulaciones", "perfil privado de postulante", "el empleador es responsable de
su proceso de selección". **Never use** "agencia", "seleccionamos candidatos",
"matching automático", "candidatos verificados", "base de talentos",
"reclutamos", "garantizamos".

### Before Phase 1 goes live (PR 6)

1. **`/terminos` — new employer section.** trabajo.com.py is not an employer,
   not an agency, not a party to the employment relationship; provides
   advertising and applicant-management software; the employer alone decides
   whom to contact and hire; no guarantee of hiring, no screening, no
   verification, no ranking.
2. **`/terminos` — employer's own obligations.** The employer is the
   responsible party (*responsable del tratamiento*) for candidate data it
   receives; it may use it only for the vacancy applied to; it may not resell,
   redistribute or build its own database from it; non-discrimination in
   listings.
3. **`/privacidad` — what an employer receives.** Plain statement that an
   employer sees the name, phone, email, message, profile and CV of people who
   applied **to that employer's own postings**, and nothing else.
4. **`/privacidad` — what the platform operator can see**, stated honestly:
   the operator can access candidate data for operation, moderation, support
   and abuse handling; such access is logged; it is distinct from what
   employers see. (This paragraph is the one that makes §5.2 defensible.)
5. **Employer activation screen** — ToS + privacy acceptance checkbox copy,
   unchecked by default, with the policy version visible.
6. **Employer dashboard disclaimer**, persistent in the layout footer: "Los
   datos de los postulantes se comparten únicamente para la vacante a la que se
   postularon. trabajo.com.py no selecciona, evalúa ni recomienda candidatos."

### Before Phase 2 goes live (PR 11)

7. **Candidate signup consent** (consent #1): what is stored, for what, for how
   long, who can see it, how to delete it. Unchecked by default; link to
   `/privacidad`.
8. **Per-application consent** (consent #2), naming the employer explicitly.
9. **`/privacidad` — candidate section**: retention periods (§4.3), the ARCO
   rights and *how to exercise them* (the `/postulante/mis-datos` link plus a
   contact address), and the statement that a profile is private and never
   browsable.
10. **`/postulante/mis-datos` UI copy**: export, rectify, withdraw consent per
    application, delete account — including an unambiguous warning that
    deletion is permanent and immediate.
11. **Deletion confirmation + result copy**, and the employer-side tombstone
    string ("El postulante eliminó sus datos.").
12. **`/publicar` and `/planes` review pass** — check the existing marketing
    copy against the vocabulary rule above; anything that already implies
    selection or curation gets rewritten in this PR.

### Ongoing

13. `POLICY_VERSION` constant, bumped whenever items 1–11 change materially, so
    `consents.policy_version` means something.
14. Email templates (if Q5 is yes): verification, password reset, 23-month
    retention warning.

---

## 8. Open questions for the business owner

Defaults are assumed so implementation is not blocked; flipping any of them
does not require rewriting this plan, except where noted.

1. **Retention period.** *Assumed: 24 months of inactivity for profiles, 12
   months after job close for application data.* Needs a real answer before
   PR 11, because the number goes in the privacy policy. Changing it later
   means re-consenting everyone.
2. **Employer accounts: admin-created or self-serve?** *Assumed:
   admin-created by invitation*, matching how admin/editor accounts work today.
   Self-serve means anyone can claim a company and read its applications, so it
   needs a verification step (domain email? WhatsApp confirmation?) that is
   itself a feature. Recommend keeping invitations for at least the first year.
3. **Track "hired"?** *Assumed: yes*, as a fifth `applications.status`. It is
   the only conversion metric with any business meaning, and it costs one enum
   value. But it is self-reported by employers and will be under-filled —
   accept that the number is directional, or drop it and report only
   `contacted`.
4. **CV storage: Cloudflare R2 or Hostinger disk?** *Assumed: R2* (§3.1).
   Needs an account and two env vars. If the answer is disk, say so before
   PR 7 and confirm a backup routine.
5. **Transactional email.** There is **no email provider in this repo today**.
   Candidate self-serve accounts realistically need one: email verification,
   password reset, the retention warning. Without it, a candidate who forgets
   their password has no recovery path and the 23-month warning cannot be sent.
   *Recommendation: add Resend (free tier covers this volume) in PR 8.* This is
   the one open question that changes PR scope, so answer it before batch E.
6. **Who is the data-protection contact?** The privacy policy needs a named
   contact for ARCO requests — an email address at minimum. Also: does the
   business want a manual review step for deletion requests, or is
   self-service immediate deletion (as designed) acceptable? *Assumed:
   immediate, self-service.*
7. **Can employers create their own job posts, or only view?** *Assumed: yes,
   creating `pending` posts that the team approves* (PR 5). If the answer is
   view-only, PR 5 shrinks to just the invitation flow.
8. **Legal sign-off.** This plan is built from two AI research passes. Before
   the Phase 2 flag flips — i.e. before we store the first real CV — a
   Paraguayan lawyer should read `/privacidad` and `/terminos` against Ley N°
   7593/2025. Budget a review, not a redesign: the design above is deliberately
   conservative, so the likely outcome is copy edits.
9. **Does the owner want the anonymous lead form kept on job pages once
   one-click apply exists?** *Assumed: yes, kept.* It converts better for
   people who will never make an account, and removing it would cut application
   volume. It also stays the WhatsApp-first path.

---

## 9. Non-negotiables this feature adds

Proposed additions to `AGENTS.md` (land with PR 14, but they bind from PR 1):

- **Employer reads go through `lib/db/employer.ts`, and every function there
  takes `companyId` as its first argument.** No admin bypass branch in that
  file, ever.
- **Admin reads of candidate data go through `lib/db/candidates-admin.ts`,
  which logs before it returns.** No candidate data read from anywhere else.
- **No public URL for a CV.** All three download paths are authorized route
  handlers.
- **Consent is append-only.** Withdrawal is a new row, never an update.
- **Deletion is a hard delete.** No soft-delete flag on candidate data.
- **No search, ranking, scoring, matching or bulk export of candidates.**
  Phase 4, gated on legal review.
