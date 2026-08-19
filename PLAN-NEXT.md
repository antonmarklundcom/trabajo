# PLAN-NEXT.md — the agreed build program (2026-08-19)

> **Written 2026-08-19 by Fable 5, from the owner's 14 recorded decisions**
> (`PLAN-PHASE3-DRAFT.md` §15). This document is the build brief for the next
> two autonomous sessions: it turns the audit triage (`PLAN-PHASE3-DRAFT.md`
> §13) plus the newly agreed feature work into two ordered PR batches with a
> model per batch, in the same style as `PLAN.md` §7.
>
> Read `AGENTS.md` first: this repo runs **Next.js 16** — consult
> `node_modules/next/dist/docs/` before writing session, header, cache or
> route code. Every session starts with `npm install`.
>
> **Scope discipline:** each PR below builds exactly what its brief says.
> B1–B7 are specified in `PLAN-PHASE3-DRAFT.md` §12.1/§13.4 — that text is
> the spec; this document only orders them and records what was added to
> each. Deviations are raised before being built, not after.

---

## 0. The program in one paragraph

Two chats. **Chat 1 (Opus 5)** does the security/correctness fixes from the
2026-08-18 audit (B1–B4, with CSP/security headers folded into B3), then adds
the transactional-email core (Resend) and an auth audit trail — the work
where a subtle mistake leaks data or silently serves the wrong thing.
**Chat 2 (Sonnet 5)** does the mechanical remainder: B5–B7, the three
notification emails, the public-UX pack, the employer plan card, error
tracking, purge monitoring, and cleanup. Both chats run PR-by-PR with
auto-merge on green (owner decision 14); every merge is a production deploy,
so the standing guardrails from `PLAN.md` §7 apply verbatim. Owner ops
(accounts, DNS, flag flips, blog cutover, lawyer review) run in parallel —
§4 is that checklist.

## 1. Preconditions before Chat 1 starts

None strictly block Chat 1's B1–B4. E1 (email) needs the Resend API key to
*verify* sending, but can be built and merged with the key documented in
`.env.example` and the send path degrading gracefully when unset — the same
pattern `GHL_WEBHOOK_URL` already uses. R2 credentials (owner decision 1)
are not needed by any PR in this program; they gate the candidate flag flip,
not the code.

## 2. Chat 1 — Opus 5, sequential, auto-merge on green

Create PR → CI green → merge → pull `main` → next PR. Never stack.

| # | PR | Spec | Added beyond the spec |
|---|---|---|---|
| 1 | **B1** — trusted client IP + one limiter module | §13.4 B1 (+ §13.3: the shared ARCO limiter instance; the seven divergent `clientIp` copies; what lands in `consents.ip` / `data_access_logs`) | — |
| 2 | **B2** — bounded cache key for free-text search | §13.4 B2 | — |
| 3 | **B3** — link/image scheme allowlist in blog Markdown | §13.4 B3 | **Security headers ride along** (owner decision 4e): `headers()` in `next.config.ts` — CSP (allowing GA4 and inline JSON-LD; use nonces or hashes only if the Next 16 docs make it clean, otherwise start with a Report-Only pass in the PR body and ship the enforced header only once the console is clean on every route group), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors`), `Referrer-Policy`. HSTS only if the PR verifies Hostinger isn't already setting it. |
| 4 | **B4** — application uniqueness + transaction boundaries | §13.4 B4 | Register any touched tables in `scripts/verify-cascades.ts` if the migration changes parent/child shape. |
| 5 | **E1** — transactional email core | New; brief below | — |
| 6 | **E2** — retention warning actually sends | New; brief below | — |
| 7 | **A1** — auth audit trail | New; brief below | — |

### E1 — transactional email core (Resend)

- `lib/email.ts` as the **only** send path (same single-seam discipline as
  `lib/data.ts` / `lib/blog.ts`). Resend SDK or plain `fetch` to their API —
  prefer `fetch`, one dependency fewer. `RESEND_API_KEY` +
  `EMAIL_FROM` in `.env.example`; **unset key = log-and-skip, never throw** —
  email must degrade the way the lead webhooks already do.
- **Email verification:** send on candidate registration; token table or
  signed token (choose from the Next 16 docs + existing `iron-session`
  idioms — sha256-hashed single-use token rows match the
  `employer_invitations` precedent and are the default), sets
  `candidates.emailVerifiedAt`. Unverified accounts still work — verification
  gates nothing yet; it exists to make consent rows evidentially solid
  (§14 D2 point 4).
- **Password reset:** `/postulante/recuperar` (+ the API routes), same
  hashed-single-use-token pattern, 30–60 min TTL, rate-limited with the B1
  limiter, **no account enumeration** (same response whether the email
  exists or not). Employer/admin reset is explicitly out of scope — those
  accounts are provisioned by the team (`scripts/set-password.ts` exists).
- All email copy Spanish (Paraguay). No marketing content — these are
  transactional. New tables registered in `verify-cascades.ts`.
- Owner does DNS (SPF/DKIM) per §4; the PR body states the exact records
  Resend asks for so the owner can paste them.

### E2 — retention warning sends (small)

`findCandidatesToWarn()` (`lib/db/retention.ts`) currently only reports.
Wire it to `lib/email.ts` inside the `db:purge` flow: warn at the window the
file already computes, record that a warning was sent (a `warnedAt` column
or equivalent — check what the purge logic needs to avoid re-warning), and
keep `--apply` semantics unchanged. This closes the gap between `/privacidad`
and behaviour (§14 D2 point 3). Opus because it touches the purge path —
`PLAN-PHASE2.md` §6 made destructive-path work Opus and nothing changed.

### A1 — auth audit trail

- New `auth_events` table: `id`, `surface` (`admin`/`empresa`/`postulante`),
  `userId`/`candidateId` (plain ints, **no FK** per `AGENTS.md`), `event`
  (`login_ok`, `login_fail`, `password_change`, `password_reset_request`,
  `password_reset_ok`, `logout`), `ip` (the B1 trusted value), `createdAt`.
  Indexed on `(surface, createdAt)`. Registered in `verify-cascades.ts`;
  the ARCO purge and admin user-deletion decide explicitly what happens to
  rows referencing a deleted account (keep as evidence with the id orphaned —
  matching the deliberate `consents` precedent — and say so in the code).
- Writes in every login/password path on all three surfaces. Failed-login
  rows record the attempted identifier hashed or truncated, never a password.
- Read surface: fold into `/admin/registros-de-acceso` as a second tab or
  table, admin-only, read-only. No export.
- Retention: add `auth_events` to the retention sweep with a stated number
  (default 24 months, same as `data_access_logs`) and to
  `retention:verify`.

**Chat 1 exit state:** audit fixes live, email core live pending DNS,
audit trail recording. Owner flips `EMPLOYER_DASHBOARD_ENABLED`
(decision 6) after this chat merges.

## 3. Chat 2 — Sonnet 5, sequential, auto-merge on green

Starts only after Chat 1 is fully merged (B5 depends on B1's pattern; N*
depend on E1). Same PR-by-PR rhythm. This batch is long — if the session
runs out of room, a second Sonnet session continues from the next unmerged
PR; the order below is the resume point.

| # | PR | Spec |
|---|---|---|
| 1 | **B5** — rate limits on authenticated candidate writes | §13.4 B5, using B1's module |
| 2 | **B6** — CI: `lint` + `tsc --noEmit` steps | §13.4 B6 |
| 3 | **B7** — shared `cachedOrRaw`, seed/DB sort parity, document `user:password` + `candidate:create` | §13.4 B7 |
| 4 | **N1** — applicant confirmation email | Below |
| 5 | **N2** — employer "new application" email | Below |
| 6 | **N3** — candidate status-change email | Below |
| 7 | **U1** — share buttons on job pages | Below |
| 8 | **U2** — numbered pagination on `/empleos` | Below |
| 9 | **U3** — "empleos similares" block | Below |
| 10 | **P1** — employer plan/featured card | Below |
| 11 | **O1** — error tracking | Below |
| 12 | **O2** — purge-run monitoring | Below |
| 13 | **C1** — housekeeping | Below |
| 14 | **D1** — DEPLOY.md: MySQL backup + restore procedure | Below |

### N1 — applicant confirmation email

On a successful application (both the anonymous lead path and the
one-click candidate path): send "recibimos tu postulación a X en Y" via
`lib/email.ts`, **after** the DB insert and webhook fan-out, in the same
`after()`-style non-blocking position the webhooks use — an email failure
must never fail the submission. Anonymous applicants only get it when they
provided an email (optional field). Transactional, no unsubscribe link
required, but include a one-line "por qué recibís esto".

### N2 — employer "new application" email

When an application lands on a job whose company has an active employer
user: notify that user (all active users of the company). Include job title
and a link to `/empresa/postulaciones` — **no applicant personal data in
the email body** (email is not an authorized CV channel; the dashboard is).
Per-company toggle: a `notifyOnApplication` boolean on the employer user or
company (owner decides copy: "Recibir avisos por correo"), default on,
editable in `/empresa/perfil`.

### N3 — candidate status-change email

When an employer moves an application to `contacted` (only that transition —
`reviewed`/`discarded` notifications would do candidates more harm than
good): "La empresa X quiere contactarte". Built now, naturally dark until
`CANDIDATE_ACCOUNTS_ENABLED` flips since only candidate-linked applications
have accounts. A per-candidate opt-out flag in `/postulante/perfil`.

### U1 — share buttons on job pages

Exactly the blog's pattern (`app/blog/[slug]/page.tsx`): `wa.me` text link,
Facebook sharer, copy-link. Plain anchors, no SDKs, no scripts, nothing
loading at page view. Spanish labels.

### U2 — numbered pagination

`/empleos` (and the `/trabajo/*` landings if they paginate): numbered links
with ellipsis, current page as text not link, `rel=prev/next` semantics via
plain links, preserving all active filters in the query string. Keep the
existing page size.

### U3 — "empleos similares"

On `/empleos/[slug]`: up to 5 published jobs sharing category (fall back to
city), **read through `lib/data.ts`** (`getJobs`), excluding the current
job, omitted entirely when empty — the same shape the blog's "empleos
relacionados" footer already has. No candidate/application data, ever.

### P1 — employer plan/featured card

Read-only card on the `/empresa` dashboard: current plan label, and when
`featured_until` is set, "Destacado activo hasta {date}" with a
"Renovar por WhatsApp" link (`NEXT_PUBLIC_WHATSAPP_LEADS`). When lapsed or
absent: a quiet upsell line linking `/planes`. Data comes through
`lib/db/employer.ts` with `companyId` first — no new write paths, admin
continues to set `featured_until` after a manual sale.

### O1 — error tracking

Sentry (free tier) via `@sentry/nextjs`, DSN from env, **no-op when unset**
(CI has no DSN). Scrub PII in `beforeSend`: no request bodies, no emails,
no tokens. Replace the bare `console.error` calls in API catch blocks with
capture + rethrow/log as appropriate. Owner creates the account (§4).

### O2 — purge-run monitoring

`db:purge` writes a completion timestamp (a one-row `ops_state` table or a
row in an existing meta table — smallest thing that works, registered in
`verify-cascades.ts` if it references nothing it needs no entry). `/admin`
dashboard shows "Última depuración: {date}", red with a warning when >35
days old. No external service, no cron dependency — the owner's monthly
run stays manual, but a missed month is now visible on the panel.

### C1 — housekeeping

- `npm audit` triage: upgrade what's safe, document what's accepted and why
  in the PR body. No major-version bumps of Next/React in this PR.
- `"engines": { "node": ">=22" }` in `package.json`.
- Delete the dead `USE_WP_BACKEND` env from `.github/workflows/ci.yml`.
- Centralize the palette: move the repeated hex values (`#1E1B17`,
  `#C0362A`, `#FBF9F6`, `#E7E1D6`…) into Tailwind theme tokens and replace
  arbitrary-value usages mechanically. **Zero visual diff** — this is a
  refactor; spot-check key pages in the build output.

### D1 — DEPLOY.md backup procedure

Document (docs-only PR): how to dump the Hostinger MySQL DB from a local
machine (`mysqldump` over Remote MySQL, per the existing §"MySQL
operations" traps), where dumps live, a monthly cadence, and a **restore
rehearsal script** the owner runs once against a scratch database (§4).
Also note what the CV/image directory backup story is under the chosen
storage drivers.

## 4. Owner ops checklist (parallel, not PRs)

| When | Action |
|---|---|
| Now | Run the Gemini deep-research prompt on CV-storage legality (delivered in chat 2026-08-19); share the result before the candidate flag flip |
| Now | Blog cutover: run the delivered command sheet (`db:migrate` + `blog:import -- --write` against production) — until then the live `/blog` is empty |
| Before E1 verification | Create Resend account; add the SPF/DKIM DNS records the E1 PR body lists; set `RESEND_API_KEY` + `EMAIL_FROM` in hPanel; redeploy |
| After Chat 1 merges | Flip `EMPLOYER_DASHBOARD_ENABLED=true` in hPanel + redeploy; invite the first employer |
| Before O1 verification | Create Sentry account; set the DSN in hPanel |
| Anytime | Create Cloudflare R2 account + bucket; set the four `CV_R2_*` vars (gates the candidate flag, not any PR) |
| After Chat 2 + D1 | Rehearse one MySQL restore per the new DEPLOY.md section |
| Before candidate flag | Lawyer reviews `/privacidad` + `/terminos` against Ley 7593/2025 (decision 8) |
| Last | Flip `CANDIDATE_ACCOUNTS_ENABLED=true` — only after: Chat 1 + Chat 2 merged, email DNS verified, R2 configured, research + lawyer both clear |

## 5. Standing guardrails (unchanged, restated for the build sessions)

- `npm install && npm run build` before every push; merge = production
  deploy; no staging.
- Never modify `drizzle.config.ts`, `lib/db/index.ts`, or `DATABASE_URL`
  handling.
- All `AGENTS.md` non-negotiables — the data seams, `visiblePredicate()`,
  server-side authorization, no-FK schema + `cascade:verify`, no candidate
  search/ranking/export, Spanish UI copy.
- New tables: no FKs, registered in `verify-cascades.ts`, retention stance
  stated.
- Anything touching production env/DB config, or removing a rollback path,
  stops for the owner regardless of auto-merge (decision 14).

## 6. Deliberately not in this program

- **Job alerts / saved searches** — deferred one round (decision 10);
  planned after notification engagement data exists.
- **Second language / i18n** — parked (decision 13); if it becomes
  strategic it gets its own Opus-scoped phase.
- **Distributed limiters / cross-instance cache invalidation** — the
  single-process assumption is now a documented DEPLOY.md constraint
  (decision 3).
- **Employer self-serve signup, multi-user company management UI, billing**
  — unchanged from `PLAN-PHASE2.md` §8 Q2's invitation-only stance.
- **Candidate search/ranking/matching/export** — Phase 4, gated on legal
  review, per `AGENTS.md`. Unchanged and not touched by anything above.
