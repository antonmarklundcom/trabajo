# PLAN-PAGOPAR.md — self-serve checkout for Destacado

> **Written 2026-08-28 by Opus 5. Planning only — no code in this document.**
>
> Status: **not started, deliberately.** The owner's decision on 2026-08-28 was
> "PagoPar first and then Bancard later in the plan… but I will not use it for a
> month or so". So the manual WhatsApp sale was made first-class instead (§1),
> and this document is the spec for the checkout when it is wanted.
>
> §9 is a copy-paste prompt. Open a new Opus session on this repo, paste it, and
> it has everything it needs.
>
> Read `AGENTS.md` first. **This repo runs Next.js 16** — session, header, cache
> and route APIs differ from training data, so consult
> `node_modules/next/dist/docs/` before writing any of it.

---

## 0. Why there is no processor yet

Stripe was ruled out at the top: **Stripe does not onboard merchants based in
Paraguay.** Defaulting to it would have produced an integration that cannot be
switched on. The owner was asked and chose PagoPar first, with Bancard as a
later second adapter (§10).

The second decision was about timing, and it is the more important one: a
Destacado is sold today in a WhatsApp conversation, and the owner wants to start
selling **this week**. A checkout nobody uses for a month is a month of
unreviewed webhook code sitting in production. So the sale path was hardened
where the money actually changes hands, and the checkout waits.

---

## 1. What exists today (PR #78 — read this before changing anything)

The manual flow is not a stopgap to be deleted. It is the fallback the
degrade rule in §5 falls back TO, and the override in §6 keeps it reachable
forever.

| Piece | Where |
|---|---|
| The product | `jobs.featured_until` — a `DATETIME`, no boolean anywhere. "Featured" is the predicate `featured_until > NOW()`, evaluated in `lib/db/queries.ts` and `lib/db/admin.ts` alike. |
| The window arithmetic | `lib/featured.ts` — `computeFeaturedUntil(now, current, days, extend)`, pure, asserted by `npm run featured:verify`. |
| The grant | `grantJobFeature()` / `revokeJobFeature()` in `lib/db/admin.ts`. Accepts DAYS, never a date. |
| The API | `POST` / `DELETE /api/admin/empleos/[id]/destacar`, role-checked `admin`/`editor`. |
| The UI | `components/admin/FeaturePanel.tsx` on `/admin/empleos/[id]`: duration buttons, amount in Gs., payment method, note. |
| The sale record | `activity_log`, actions `feature_grant` / `feature_revoke`, meta carrying `days`, `amountGs`, `method`, `note`, `channel: 'whatsapp_manual'`. |
| Finding what to renew | `/admin/empleos?featured=vencido`. |
| The sales CTA | `/planes` Destacado card → `wa.me` with a prefilled Spanish message. |
| What the employer sees | `components/empresa/PlanCard.tsx` — read-only, with "Renovar por WhatsApp". |

`channel: 'whatsapp_manual'` in the meta exists **for this document**: once
PagoPar lands there are two ways a window opens, and reconciliation needs to
tell them apart from day one rather than by inferring it from a NULL.

---

## 2. Processor

**PagoPar first.** PY-native, guaraníes, onboarding a small merchant can
complete without a bank relationship, and it covers the cash/transfer methods
(Aqui Pago, Practipago and similar) that a large share of Paraguayan buyers
actually use. Bancard is the later second adapter (§10) — bigger reach, heavier
onboarding.

**Do not write the integration from memory.** API shapes, the exact hashing
scheme for the token, the callback contract and the field names all change, and
this document is deliberately silent on them. The integrating session's FIRST
task is to read PagoPar's current developer documentation and write down, in the
PR body:

1. how a payment request is created, and in what units the amount is sent
   (guaraníes have no decimal places — confirm whether the API wants an integer);
2. the exact token/signature scheme, including which fields are concatenated, in
   what order, and with which hash;
3. what the confirmation callback posts, whether it expects a specific response
   body, and how PagoPar retries when it does not get one;
4. whether the order identifier is chosen by us or by them.

If any of those cannot be answered from the live docs, **stop and ask the
owner** rather than guessing. A guessed signature scheme is an endpoint that
verifies nothing.

---

## 3. Schema

One migration, additive, and the two `AGENTS.md` rules apply: **no foreign
keys**, and the new table must be registered in `scripts/verify-cascades.ts`.

### `feature_orders`

| Column | Note |
|---|---|
| `id` | |
| `job_id` int NOT NULL | Plain int, no FK. |
| `company_id` int NOT NULL | Denormalised so an order survives a job being re-pointed, and so an employer-scoped read filters on `company_id` like everything else in `lib/db/employer.ts`. |
| `days` int NOT NULL | From `FEATURE_DURATION_DAYS`. What was bought, not when it ends — the end date is computed at fulfilment. |
| `amount_gs` int NOT NULL | Guaraníes, integer. |
| `status` enum(`pending`,`paid`,`failed`,`expired`,`cancelled`) | |
| `processor` enum(`pagopar`,`bancard`) | Present from the first migration so the Bancard adapter needs no schema change. |
| `processor_order_id` varchar UNIQUE | Whatever identifies this order to the processor. UNIQUE is load-bearing — it is half of the idempotency guarantee in §4. |
| `paid_at` datetime NULL | |
| `fulfilled_at` datetime NULL | **Distinct from `paid_at`.** "The money arrived" and "the window was opened" are two facts, and a bug between them is only visible if both are recorded. |
| `featured_until` datetime NULL | The window this order actually produced. Copied at fulfilment, so a later manual override does not rewrite history. |
| `created_at` / `updated_at` | |

Indexes: `(company_id, created_at)`, `(job_id, created_at)`, `(status, created_at)`.

### `payment_events`

Every callback delivery, verified or not, stored raw:
`id` · `order_id` int NULL · `processor` · `signature_valid` boolean ·
`payload` json · `received_at` · `ip` varchar(45) NULL.

Rows are written **before** verification and **before** any state change, so a
rejected delivery leaves evidence. This is the reconciliation trail; it is also
the only thing that answers "they say they paid and nothing happened" without
asking the processor.

Both tables go into `scripts/verify-cascades.ts`. `jobs` IS hard-deleted
(`deleteJob` in `lib/db/admin.ts`), so `feature_orders` is a `DEPENDENCIES`
entry with `jobs` as a parent and needs a cleanup beside that delete. Decide
deliberately whether `payment_events` is a `DELIBERATE_ORPHAN` — the argument
that it is: it is a record of what a processor sent us, not the customer's data,
and it must outlive an order that gets deleted.

---

## 4. The webhook — the part that is not negotiable

`POST /api/pagos/pagopar/webhook`

1. **Signature verification is mandatory.** No branch, no env flag, no "dev
   mode" that skips it. An endpoint that flips `featured_until` on an unverified
   POST is a public URL that grants paid placement for free. Compare in constant
   time (`node:crypto` `timingSafeEqual` — `lib/db/user-tokens.ts` has the
   pattern).
2. **Log first.** Insert the `payment_events` row before verifying, so a forged
   or malformed delivery is still evidence.
3. **Reject with the right status.** Invalid signature → `401`, and no state
   change of any kind.
4. **Idempotent.** A retried delivery must not extend the window twice. Make the
   write the check, the way `acceptInvitation()` and `redeemUserToken()` already
   do: `UPDATE feature_orders SET status='paid' … WHERE id=? AND status='pending'`,
   and fulfil only when `affectedRows === 1`. Do not check-then-write.
5. **Fulfil through the existing path.** Call `computeFeaturedUntil()` and the
   same grant logic `grantJobFeature()` uses — not a second `UPDATE jobs`
   somewhere. The window arithmetic must have one implementation, and
   `npm run featured:verify` must still cover it.
6. **Log the grant** to `activity_log` with `channel: 'pagopar'` and a NULL
   actor (no human did it), mirroring the manual meta so both channels
   reconcile from one query.
7. **No session.** It is a server-to-server POST. It must therefore not be
   reachable in a way that lets it act as a user: it takes an order id from the
   payload and nothing from a cookie.
8. **Amount and days come from OUR order row**, never from the callback body.
   A callback that can name the number of days is a callback that can buy a year
   for one guaraní.

---

## 5. Env vars, and what "not configured" means

`.env.example`, same unset-degrades pattern as `RESEND_API_KEY`:

```
PAGOPAR_PUBLIC_KEY=
PAGOPAR_PRIVATE_KEY=
```

**"Degraded" here does NOT mean a broken checkout.** With either key unset:

- the "Pagar en línea" button is not rendered at all (server-side check, not
  CSS);
- `/planes` and `PlanCard` keep exactly today's WhatsApp CTA;
- the webhook route returns `404`, not `500`;
- everything in §1 keeps working.

A half-configured deploy must look like today's site, not like a payment page
that fails after the customer commits. Add the check to `lib/flags.ts` next to
the others, and note that unlike the feature flags this one is derived from the
credentials being present rather than from a separate switch — there is no
useful state where the keys exist and checkout is off.

---

## 6. The manual override stays

`grantJobFeature()`, `revokeJobFeature()`, the `FeaturePanel`, and the raw
`Destacado hasta` field on `JobForm` are **not removed and not deprecated**.
They are how a phone sale, a refund, a comped listing and a mis-keyed order are
handled, and every one of those will still happen after the checkout ships.

An order fulfilled by webhook and a window opened by hand must be able to
coexist on one job; §3's `featured_until` column on `feature_orders` is what
keeps the order's history readable after a manual override changes the job.

---

## 7. What must not change

- **The moderation gate.** A paid Destacado is still a `published` job that
  `/admin` approved. Nothing in this work may let payment publish a listing, and
  `npm run moderation:verify` must stay green — if a change makes it fail, the
  change is wrong, not the script.
- **`lib/db/employer.ts`'s contract** — `companyId` first, no admin bypass. An
  employer's view of their own orders belongs there, under that rule.
- **No FKs in `lib/db/schema.ts`.**
- **UI copy is Spanish (Paraguay).**
- **`drizzle.config.ts`, `lib/db/index.ts`, `DATABASE_URL` handling** — never
  touched.
- **One CI workflow, new checks are new steps.**

---

## 8. PR breakdown

Each merges green before the next starts; merging to `main` is a production
deploy with no staging.

| PR | Scope | Model |
|---|---|---|
| A | Schema + `lib/db/feature-orders.ts` + cascade registration + a verify script for the idempotency predicate. No routes, no UI. | Opus |
| B | The PagoPar adapter and the webhook. Signature verification, `payment_events`, idempotent fulfilment through `computeFeaturedUntil()`. Env-gated. | Opus |
| C | Checkout UI: the button on `PlanCard` / `/planes` / the employer job page, return and cancel pages, and the employer's order history. | Sonnet |

Do not fold A into B. The schema landing on its own means the migration runs
against production as its own reviewable event, which is the one thing this repo
has no staging environment to rehearse.

---

## 9. The prompt

Paste this into a new **Opus** session on `antonmarklundcom/trabajo`:

> Read `AGENTS.md` in full, then `PLAN-PAGOPAR.md` end to end, then
> `ARCHITECTURE.md` §4 (schema), §6 (job lifecycle) and §8 (caching). This repo
> runs Next.js 16 — read the relevant guides in `node_modules/next/dist/docs/`
> before writing any route, cache or header code; do not port App Router
> snippets from memory.
>
> Build PLAN-PAGOPAR.md PR A, then PR B, then PR C — one PR each, sequential,
> never stacked: create the PR, get CI green, merge, pull `main`, start the next.
>
> Before writing a line of PR B, read PagoPar's current developer documentation
> and record in the PR body the four things §2 lists — the payment-request
> shape, the exact token/signature scheme, the callback contract and retry
> behaviour, and who chooses the order id. Do not infer any of them from
> training data. If the live docs do not answer one, stop and ask the owner.
>
> §4 is non-negotiable in full: signature verification with no bypass branch,
> `payment_events` written before verification, idempotent fulfilment via a
> conditional UPDATE whose `affectedRows` is the check, amount and days read
> from our own order row and never from the callback body, and fulfilment
> through `computeFeaturedUntil()` rather than a second UPDATE of `jobs`.
>
> §5's degrade rule is equally firm: with `PAGOPAR_*` unset, the site must be
> byte-for-byte today's site — the WhatsApp CTA, no checkout button rendered at
> all, and the webhook route returning 404. Never a checkout that fails after
> the customer commits.
>
> Do not remove or deprecate the manual path (§6): `grantJobFeature()`,
> `revokeJobFeature()`, `components/admin/FeaturePanel.tsx` and the raw
> `Destacado hasta` field all stay.
>
> Standing guardrails: `npm install && npm run build`, `npm run lint`,
> `npm run typecheck` and every `*:verify` script green locally before each push
> — CI minutes are budgeted (`AGENTS.md`), so a red run is a real cost. Never
> modify `drizzle.config.ts`, `lib/db/index.ts` or `DATABASE_URL` handling.
> Anything touching production env or DB config stops for the owner. New checks
> are new steps in the single existing workflow.
>
> `npm run moderation:verify` must stay green throughout: payment buys
> placement, never publication.

---

## 10. Bancard, later

Second adapter, not a rewrite. `feature_orders.processor` already has the enum
value, and §4's rules are processor-independent — a Bancard PR should be a new
adapter module plus a second webhook route, with the fulfilment path untouched.

Revisit when PagoPar has been live long enough to know what the reconciliation
actually needs, or when a customer asks for a card option PagoPar does not
carry. Not before: two payment integrations with no live volume is two
unreviewed webhook endpoints.
