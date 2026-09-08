# PLAN-GROWTH.md — employer WhatsApp conversion + design/SEO for organic growth

> **Written 2026-09-08 by Fable 5.1. Planning only — no code in this document.**
>
> Two goals, in priority order, as the owner set them: (1) get employers who
> want to hire to *message on WhatsApp* instead of abandoning a form, and
> (2) grow free organic traffic through design and SEO/content architecture.
> Everything here is executed by Sonnet/Opus sessions later, PR by PR, with the
> same rhythm as `PLAN-NEXT.md` (create PR → CI green → merge → pull `main` →
> next PR, never stacked). Model per PR is in §6.
>
> Read `AGENTS.md` first. **This repo runs Next.js 16** — metadata, caching,
> `searchParams`, route and image APIs differ from training data, so every
> session consults `node_modules/next/dist/docs/` before writing any of them.
> Every session starts with `npm install`.
>
> The diagnosis in §2–§3 was produced by reading the code on `main` at
> `2501e47` (PR #83). File:line references are to that commit; they will
> drift, the facts will not until a PR changes them.

---

## 0. The program in one paragraph

The employer funnel contradicts itself: the homepage promises "recibí
postulantes por WhatsApp en minutos" and links to a form that promises a
callback "en menos de 24 horas", the site has no employer-facing WhatsApp entry
point above `/planes`, the one it has is red instead of green and untracked,
the success screen is a dead end, and the 24-hour promise is backed by no
notification to anyone. **Batch W** (five small Sonnet PRs) fixes that with one
shared WhatsApp module, a consistent green tracked CTA, a two-path `/publicar`,
a team notification — and, by owner decision, **no promise about applicant
volume or speed anywhere**, because the traffic to keep it does not exist yet.
**Batch P** is the launch promotion that builds job supply: the first 100
approved listings get Destacado for 90 days free, applied by an admin at
approval through the existing `featured_until` grant, with a public counter
that switches the copy off by itself. The SEO baseline is solid but has six
real holes: `validThrough` is the *paid-promotion* date, expired jobs hard-404,
filtered `/empleos` URLs are an uncanonicalised duplicate-content surface, the
taxonomy landings show only 20 jobs with no pagination and no static
generation, there are no city-level landings, and the blog is reachable from
nowhere. **Batch S** fixes those. **Batch C** turns the blog from three orphan
articles into a topical-cluster content engine with category archives, related
posts and two-way links to the job taxonomy — gated on content existing first.
**Batch D** is the redesign direction: mobile-first job detail with a sticky
apply bar, a homepage that speaks to both audiences, a listing page with an
`h1`, and one design-token pass. Every owner decision is recorded in §7; the
work runs as one Opus session followed by four Sonnet sessions, each from a
single prompt in §10; §11 is the job-supply playbook the promotion serves.

---

## 1. What this plan is bound by

All of `AGENTS.md`, restated where this program touches it:

- **Public job reads go through `lib/data.ts`** and, in the DB path, the
  single `visiblePredicate()`. Every new public read of the catalogue (city
  landings, per-category city counts, the closed-job tombstone) is a new
  **seam function with both a seed and a DB implementation**, covered by
  `scripts/parity-check.ts`. No page reads `lib/db/queries.ts` directly.
- **Blog reads go through `lib/blog.ts`** and every public read there passes
  `publishedPredicate()`; `scripts/verify-blog.ts` asserts it and every blog
  PR keeps it green.
- **No FK constraints. No candidate data on any public surface.** The blog
  and the landings read the job catalogue and nothing else (`PLAN-PHASE3-DRAFT.md`
  §5.4 — no "X personas se postularon" widgets, ever).
- **Slugs are live SEO URLs.** The one slug change proposed here (`capiatá` →
  `capiata`, §4 S1) ships with a 301 in the same PR.
- **Employer jobs land `pending`.** Nothing here touches job status;
  `moderation:verify` stays green. A WhatsApp conversation is a sales
  channel, not a publishing channel.
- **Spanish (Paraguay) UI copy**, voseo, including every new CTA and every
  blog article. Docs and code comments in English.
- **CI budget.** New checks are new **steps** in the single job, never a new
  workflow. Lighthouse-in-CI is explicitly *not* added (§9).
- **Model cost.** Sonnet is the default. Opus only where §6 says so. Fable
  is never a subagent or a spawned session for this program.

Two new rules this program adds to `AGENTS.md` when W1 lands:

- **Every `wa.me` link on the site is built by `lib/whatsapp.ts`.** No
  component or page concatenates `https://wa.me/` itself. The number comes
  from `NEXT_PUBLIC_WHATSAPP_LEADS` (site) or from the job row (seeker →
  employer), never from a literal. `npm run whatsapp:verify` asserts it from
  source.
- **One analytics vocabulary.** `lead_submit` and `whatsapp_click` are the
  only two event names; their parameters are typed in `lib/analytics.ts`
  (§4 W1). A new CTA reuses them, it does not invent a third.

---

## 2. Diagnosis A — the employer-inbound funnel

### 2.1 The funnel as it exists

| Entry | CTA (verbatim) | Goes to | Notes |
|---|---|---|---|
| Header, desktop + mobile menu | `Publicá tu empleo` / `Publicar empleo` | `/publicar` | gold button; mobile menu also has `Contacto` |
| Homepage band `app/page.tsx:84-100` | `¿Necesitás contratar?` — `Publicá tu empleo y recibí postulantes por WhatsApp en minutos.` — `Publicá tu empleo` | `/publicar` | **the contradiction** |
| `/publicar` `app/publicar/page.tsx:25-28` | `Completá el formulario y nuestro equipo te contactará en menos de 24 horas` | 8-field form | zero WhatsApp mentions; badge `⚡ Respuesta rápida` |
| `/publicar` success `components/EmployerForm.tsx:104-106` | `¡Recibimos tu solicitud! Nuestro equipo te contactará en menos de 24 horas` | nothing | dead end: no WhatsApp, no `/planes`, no "mientras tanto" |
| `/planes` Destacado `app/planes/page.tsx:56-58,138-154` | `Consultá precios por WhatsApp` | `wa.me` prefilled | **the only employer wa.me above the dashboard**; styled brand red, no GA4 event |
| `/planes` Empresa | `Hablemos` | `/contacto` | a form, for the highest-value plan |
| `/contacto` tile `app/contacto/page.tsx:23-42` | `WhatsApp — Respondemos en minutos` | `wa.me` generic message | untracked; message does not say "publicar" |
| Footer | `Publicá tu empleo`, `Planes y precios`, `Contacto` | pages | no phone, no WhatsApp, no email anywhere in the footer |
| `/empresa` dashboard `components/empresa/PlanCard.tsx` | `Renovar por WhatsApp →` | `wa.me` | behind `EMPLOYER_DASHBOARD_ENABLED`; untracked |

There is **no floating or sticky WhatsApp element on any page**
(`app/layout.tsx` renders Header, main, Footer, Analytics). `/planes` is not
linked from the homepage at all.

### 2.2 Findings

1. **Promise/delivery mismatch at the top of the funnel.** "WhatsApp en
   minutos" → form → "24 horas". An employer who read the band came for the
   chat; the form is the abandonment point.
2. **No WhatsApp path where employer intent is highest.** `/publicar` is the
   page every employer CTA converges on and it has no `wa.me` link, not even
   on the success screen.
3. **The only WhatsApp CTA is visually wrong and unmeasured.** `--color-wa`
   exists in `app/globals.css:28-29` but the `/planes` CTA is `bg-brand`
   (red). None of the three employer `wa.me` anchors fire `whatsapp_click`;
   only the seeker button does (`components/WhatsAppButton.tsx:44`). The
   owner cannot currently see employer WhatsApp conversions in GA4 at all.
4. **The 24-hour promise has no mechanism behind it.** An employer submission
   fans out to `GHL_WEBHOOK_URL` / `GOOGLE_SHEETS_WEBHOOK_URL` if set; the
   Resend core (`lib/email.ts`, PR #59) sends nothing for employer leads
   (`app/api/v1/leads/route.ts:91-107` emails only on seeker applications).
   If the webhooks are unset, the only trace is a `pending` row in `/admin`.
5. **Three analytics vocabularies.** GA4 gets `lead_type` values
   `employer_post` / `application` / `contact`; the CRM payload only ever
   says `employer` / `seeker` (`lib/leads.ts:77`). Nothing maps them.
6. **`/contacto` launders general questions into fake job posts.**
   `components/ContactForm.tsx:47-53` hardcodes `companyName: 'Contacto
   general'`, `jobTitle: 'Consulta general'`, `categorySlug: 'administracion'`,
   `citySlug: 'asuncion'` — every contact message arrives in the CRM as an
   Asunción administración vacancy. It also has no honeypot.
7. **`/publicar` writes twice with different data.** `/api/v1/leads` gets 8
   fields; the fire-and-forget `/api/publicar` (`components/EmployerForm.tsx:78-90`)
   drops `contactName` and `email`, so the pending job carries no
   contact-person name, and a failure there is swallowed on both ends.
8. **Config drift.** `NEXT_PUBLIC_WHATSAPP_LEADS` is required by README and
   used by three files, and **absent from `.env.example`** — a fresh local
   copy silently hides the `/contacto` tile and degrades the `/planes` CTA to
   `/contacto`. `NEXT_PUBLIC_BUSINESS_NAME` and `NEXT_PUBLIC_FEATURED_BADGES`
   are set in CI and read by no code.
9. **Two golds for the same CTA.** `#E6B25A`/`#d8a548` are literal on the
   homepage band and mobile menu; the desktop header uses the `gold` token
   (`#B0812C`). The most important employer button is not on the design
   system.

### 2.3 What "good" looks like for this market

Paraguayan B2B contact happens on WhatsApp. The form is the *fallback* for
the employer who is at a desk at 23:00 or who wants to paste a long
description; it is not the primary path. So the site should:

- Offer WhatsApp **first** wherever employer intent shows (homepage band,
  `/publicar`, `/planes`, `/contacto`, mobile menu, footer), in **green**, with
  a **prefilled message that names the intent** so the team knows what the
  chat is about before opening it (the `/planes` Destacado message already
  does this right).
- Keep the form as the explicit second option with an honest promise.
- Never leave an employer on a screen with nothing to tap next.
- Make an honest response-time promise. "En minutos" is only true inside
  business hours, and the owner has ruled (§7 D1) that the site promises
  nothing about applicant speed or volume at all. The only time promise is
  the team's own: "Te respondemos el mismo día hábil (lunes a viernes, 8 a
  18)."
- Measure every WhatsApp tap with audience + intent.

---

## 3. Diagnosis B — design, SEO, performance

### 3.1 What is already right (do not "improve" these)

ISR everywhere with on-demand invalidation from admin writes; unique
metadata per job; `JobPosting`, `BreadcrumbList`, `ItemList`, `BlogPosting`
JSON-LD; dynamic sitemap that walks every job page and excludes empty
taxonomies; `noindex` on empty landings; blog slug renames mint 301s; no
third-party UI libraries; GA4 only when configured; `next/font` Inter with
`display: swap`; security headers with a Report-Only CSP. Core Web Vitals
risk is **low**: the LCP element on every page is text, there is no
web-font third-party origin, no carousel, no layout-shifting ads. The
performance items below are hygiene, not rescues.

### 3.2 Site-wide

| # | Finding | Where |
|---|---|---|
| S-1 | **No `alternates.canonical` on any page except `/blog/[slug]`.** | `app/layout.tsx`, every `generateMetadata` |
| S-2 | No `Organization` / `WebSite` JSON-LD on the homepage; homepage has no own metadata (inherits the layout default), no Twitter card anywhere. | `app/page.tsx` |
| S-3 | **The blog is linked from nowhere** — not header, footer, homepage, job pages, or landings. Only the sitemap. | `components/Footer.tsx`, `NavMenu.tsx` |
| S-4 | Footer city links go to `/empleos?ciudad=…` (filter URLs), not to landings; only 4 of 7 cities and 6 of 10 categories. | `components/Footer.tsx:4-18` |
| S-5 | **No city-level landing exists.** `/trabajo/[categoria]/[ciudad]` requires a category; "trabajo en Asunción" — the highest-volume local query shape — has no page. | routing |
| S-6 | `cities.json` has the accented slug `capiatá` → `/trabajo/x/capiat%C3%A1`. | `lib/seed/cities.json` |
| S-7 | `<time datetime>` is used nowhere; dates are prose only. | `JobCard`, job detail, blog |
| S-8 | `next/image` is used nowhere; raw `<img>` with lint-disables, no `loading="lazy"`, no `width/height` on job photos. | `app/empleos/[slug]/page.tsx:187-194`, `CompanyAvatar.tsx` |
| S-9 | Tokens partly bypassed: a fourth gold (`#E6B25A`), `#FBF3E0`, `#EDDCB4`, `#FDF8EC`, `#44403A`, `#3E5F9E`; `--radius-*` and `--shadow-*` tokens unused; arbitrary `rounded-[10/12/14/16px]` everywhere; a `<style>` block inlined in the job page body. | `app/globals.css` vs usages |
| S-10 | `zod` is bundled into the public client via `components/LeadForm.tsx:4`; Sentry client loads on every public view. | bundle |

### 3.3 Homepage `/`

- One `h1`, then four section `h2`s **and one `h2` per JobCard**
  (`components/JobCard.tsx:38`) — ~14 job titles at the same level as the
  section headings on every page that uses the card.
- Mobile above the fold: sticky header + `h1` + subhead + three stacked
  search rows (input, city select, button) + chip row. The first job is far
  below the fold. The hero chips are raw `<a>` (`SearchHero.tsx:109-116`).
- Content order: hero → Destacados → categories → recientes → employer band.
  No city block, no blog block, no trust/explainer for either audience,
  no `/planes` link, no empty state for "Últimos empleos".
- The employer band is the last thing on the page and routes to the form.

### 3.4 `/empleos` listing

- **No `h1`.** The highest heading is the sidebar's `h2 "Filtros"`.
- **Filter state is client `router.push` only** (`FilterPanel.tsx:57-71`);
  not one crawlable `<a>` for a filter value. Fine *if* the landings are
  the crawlable surface — they are, but nothing links the listing to them.
- **Every filter/sort/page permutation is HTTP 200, indexable,
  uncanonicalised, with one shared description**; `categoria`, `tipo`,
  `nivel`, `modalidad`, `salario_min`, `orden` do not change the title.
  `?ciudad=ciudad-del-este` renders the raw slug in the title.
- `rel=prev/next` only as anchor attributes; awaiting `searchParams` makes
  the route dynamic (correct, but then `revalidate` is only the data bound).
- Single-column results at every breakpoint (the other grids are 2-col at
  `md`). Mobile "Filtros" trigger ≈36 px tall; the drawer has no
  `role="dialog"`, focus trap or Escape.
- "Relevancia" and "Destacados primero" fall through to the same ORDER BY
  as "Más recientes" (`lib/data.ts:83-92`) — two sort options that only add
  duplicate URLs.
- Empty state: "Intentá con otros criterios o ver todos los empleos." No
  relaxation hint, no popular searches.

### 3.5 `/empleos/[slug]` job detail

- **`validThrough: job.featuredUntil`** (`app/empleos/[slug]/page.tsx:74`).
  That is the *Destacado* window, not the expiry. Non-promoted jobs emit no
  `validThrough`; promoted ones tell Google the posting ends when the ad
  spend ends. `jobs.expiresAt` exists in the DB and is not on the public
  `Job` type (`lib/types.ts:16-35`).
- **`directApply` absent**; `identifier` absent; JSON-LD `description` is
  raw Markdown with only `**`/`*` stripped (Google wants HTML).
- **Expired / archived job URL → generic 404.** `getJob()` returns `null`
  once the visibility predicate excludes it, so the visitor lands on
  `app/not-found.tsx` with two buttons. The job's link equity, the "empleos
  similares" recirculation and the WhatsApp intent all die there. This is
  also the most common way a visitor arrives from a stale WhatsApp forward.
- **`generateStaticParams` prerenders 20 jobs** (`getJobs({})` page 1); the
  rest are cold on first hit. The sitemap walks all pages correctly.
- **No sticky apply CTA on mobile.** The `aside` with WhatsApp + form
  renders *after* the description, the share card and up to five similar
  jobs (`flex-col`), so the primary action is at the bottom of a long page.
  On a WhatsApp/mobile-first market this is the single largest conversion
  leak on the seeker side.
- No link to the job's city landing (both slugs are in hand); no company
  page exists. `ApplySection`/`SaveJobSection` each `fetch` on mount for
  every visitor (dark today: `CANDIDATE_ACCOUNTS_ENABLED=false`).
- `A convenir` shown identically for "hidden" and "unknown" salary.

### 3.6 `/trabajo/[categoria]` and `/trabajo/[categoria]/[ciudad]`

- **No `generateStaticParams`** on either level though the slug lists are
  static JSON; 10 + up to 70 pages render cold.
- **No pagination**: only the first 20 jobs, and the `ItemList` and the
  "Por ciudad" chips are derived from that page-1 slice
  (`[categoria]/page.tsx:62-64`) — a city whose jobs sit on page 2 gets **no
  inbound link at all**, and the chips are the *only* path into city pages.
- Intro copy states `jobs.length` (≤20) as the total. `.toLowerCase()` on
  names yields "Trabajo de tecnología e it en Paraguay" in `h1` and title.
- The category page's terminal CTA sends to `/empleos?categoria=…` — into
  the uncanonicalised listing. City page has no sibling-city or related-
  category links. Neither has a canonical or an OG override. No editorial
  copy, no blog links — these are the pages that should *own* the topical
  clusters and they are the thinnest on the site.
- `[ciudad]/generateMetadata` runs a second `getJobs` only to decide robots.

### 3.7 Blog

Three published articles, one draft, category `analisis-laboral` empty.
Schema: `blog_posts` with `category` as a 3-value MySQL enum (`lib/db/schema.ts:713`),
`relatedCategorySlug` / `relatedCitySlug` (hand-picked), `authorUserId`
(written, never read), no tags, no index on `category`.

- No category archives (`/blog` accepts no params; `queryPublishedPosts()`
  takes no filter), category pills are non-clickable spans.
- No pagination: `/blog` renders every post and the `ItemList` enumerates
  all of them.
- No related posts, no prev/next, no byline (JSON-LD author is the
  Organization; `publisher` has no `logo`; no `inLanguage`/`articleSection`).
- No heading ids from `marked` → no TOC, no deep links.
- Index cards drop the cover image though `coverUrl` is in the meta.
- `invalidateBlogContent()` does not revalidate `/sitemap.xml`
  (`lib/cache.ts:93-107`); jobs do.
- The category list is hardcoded in three places (`schema.ts:713`,
  `lib/blog.ts:141-148`, `components/admin/BlogPostForm.tsx:8-12`).
- Blog → jobs is one hop via the optional 5-job footer; jobs → blog,
  landings → blog, home → blog: absent. **`PLAN-PHASE3-DRAFT.md` §5.3's
  threshold for archives (≥5 posts across ≥2 categories) is not met, and
   that reasoning still holds: archives are built after the content exists,
  not before.** Batch C is ordered accordingly.

---

## 4. The PR program

Conventions for every PR below, unstated per row: Spanish copy; `npm run
build` + `lint` + `typecheck` + the relevant `*:verify` green locally before
push; one PR = one merge = one production deploy; PR body lists the pages
touched and, where visual, a before/after screenshot from `npm run build &&
npm start`. "Files" lists are the expected footprint, not a fence.

### Batch W — WhatsApp conversion (do first; ~1 week of Sonnet PRs)

#### W1 — one WhatsApp module, one green CTA, one event vocabulary

The foundation every other W PR uses. No page copy changes yet beyond what
the shared component forces.

- `lib/whatsapp.ts` (server-safe, no `server-only`; a number and a string):
  - `siteWhatsAppNumber(): string | null` from `NEXT_PUBLIC_WHATSAPP_LEADS`.
  - `EMPLOYER_INTENTS` = `publicar | destacado | empresa | contacto | renovar`
    with one Spanish prefilled message each, e.g. `publicar` → `Hola, quiero
    publicar un empleo en trabajo.com.py.` and an optional context suffix
    (`Puesto: {jobTitle} · Empresa: {companyName}`) used by W3's success
    screen. `destacado` keeps the exact `/planes` message from PR #78.
    `empresa` → `Hola, quiero consultar por el plan Empresa (varios avisos por
    mes) en trabajo.com.py.`
  - `waHref(number, message)` — the only place `https://wa.me/` is written.
    `components/WhatsAppButton.tsx` (seeker) and `components/ShareLinks.tsx`
    switch to it; their messages and behaviour are unchanged.
- `components/WhatsAppCta.tsx` (`'use client'`): `variant: 'button' |
  'link' | 'pill'`, `intent`, optional `context`, `label`, `size`. Renders
  the `bg-wa hover:bg-wa-strong` recipe from `WhatsAppButton.tsx:55` and the
  shared `WhatsAppIcon` (move the icon to `components/icons/WhatsAppIcon.tsx`;
  delete the three copies). Returns `null` when the number is unset, with the
  caller deciding a fallback (W2–W5 always pass one). `onClick` fires
  `track('whatsapp_click', …)`; the navigation is not prevented (same
  leave-page-safe pattern as the seeker button). **No `sendBeacon` lead for
  employer taps** — there is no name or phone to record; GA4 is the record.
- `lib/analytics.ts`: type the two events.
  `whatsapp_click { audience: 'employer'|'seeker', intent, job_slug?,
  category?, city?, source_page }` and `lead_submit { lead_type:
  'employer'|'seeker'|'contact', channel: 'form' }`. Update the three
  existing `track()` calls to the typed vocabulary (`employer_post` →
  `employer`, `application` → `seeker`). Document both events in
  `README.md` §Analítica so the owner can mark them as GA4 conversions.
- `.env.example`: add `NEXT_PUBLIC_WHATSAPP_LEADS`, `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SHOW_PLANS` with comments; delete the
  dead `NEXT_PUBLIC_BUSINESS_NAME` / `NEXT_PUBLIC_FEATURED_BADGES` from
  `ci.yml`, README and DEPLOY (or wire them — they are read by no code; delete).
- `scripts/verify-whatsapp.ts` + `npm run whatsapp:verify` + a CI step:
  source-text assertions in the style of `verify-moderation.ts` — the
  literal `wa.me` appears in exactly one file (`lib/whatsapp.ts`); every
  `track('whatsapp_click'` / `track('lead_submit'` call site type-checks
  against the vocabulary (the TypeScript types do this; the script asserts
  no untyped string event names exist); `.env.example` contains
  `NEXT_PUBLIC_WHATSAPP_LEADS`.
- `AGENTS.md`: the two new non-negotiables from §1.

Verification: build; `whatsapp:verify`; seeker button on a job page still
opens the *job's* number with the unchanged message; `/planes` Destacado
still opens the site number with the PR #78 message.

#### W2 — the homepage band and the global entry points

- **Homepage band** (`app/page.tsx:84-100`): keep `¿Necesitás contratar?`.
  Body: `Publicá tu empleo gratis. Los postulantes te escriben directo a tu
  WhatsApp.` (§7 D1: **no promise about applicant volume or speed anywhere
  on the site** — the current "en minutos" line is removed, not softened.)
  While the launch promotion (Batch P) is active, a second line from
  `lib/promo.ts`: `Promoción de lanzamiento: los primeros 100 avisos salen
  destacados 90 días, gratis. Quedan {remaining}.` Primary:
  `<WhatsAppCta intent="publicar" variant="button">Publicá por WhatsApp</WhatsAppCta>`
  (green, on the dark band). Secondary, outline, beside it: `Publicar con el
  formulario` → `/publicar`. Third, text link: `Ver planes y precios` →
  `/planes` (the page is currently unreachable from the homepage). Response
  time line under the buttons (§7 D1), rendered from one constant
  `WHATSAPP_HOURS_COPY` in `lib/whatsapp.ts` so every page says the same thing.
- **Mobile menu** (`components/NavMenu.tsx:105-118`): the bottom block becomes
  `Publicá por WhatsApp` (green, `intent="publicar"`) + `Publicá tu empleo`
  (gold, `/publicar`); `Contacto` stays in the link list. Desktop header keeps
  the gold `Publicar empleo` button — no WhatsApp in the desktop bar (it is
  the one place where a green button would read as seeker-facing).
- **Footer**: new "Contacto" line in the brand column — WhatsApp pill
  (`intent="contacto"`), the hours copy, and the `/contacto` link. No email
  (§7 D9: WhatsApp is the only contact channel).
- **Floating WhatsApp button** — scope per §7 D2: rendered
  by a `<FloatingWhatsApp />` component mounted in the *page* of `/`,
  `/publicar`, `/planes`, `/contacto` only — **not** in `app/layout.tsx`, so
  it never appears on `/empleos*`, `/trabajo/*`, `/blog*` where a seeker
  would tap it expecting to apply. Bottom-right, `intent="publicar"`, with a
  short label that disambiguates (`¿Publicás un empleo?`), `aria-label`, hides
  while the mobile menu is open, respects a `pb-` safe-area. `position:
  fixed` element with no layout impact = zero CLS.
- Gold: leave the literal hex here; D1 (Batch D) applies §7 D3 mechanically.

#### W3 — `/publicar` as a two-path page

- Page header: `h1` `Publicá tu empleo gratis`. Lead: `Elegí cómo preferís
  hacerlo.` Two cards, WhatsApp first on mobile and desktop:
  - **Card A — Por WhatsApp (más rápido).** Three lines: `Mandanos el
    puesto, la ciudad y un número de contacto. Te respondemos en minutos
    {hours copy} y lo publicamos cuando esté aprobado.` Green CTA
    `intent="publicar"`.
  - **Card B — Con el formulario.** `Ideal si querés pegar la descripción
    completa. Te contactamos por WhatsApp el mismo día hábil.` (the honest
    version of "24 horas"; wording is `WHATSAPP_HOURS_COPY`). The existing form.
- The three emoji badges go; the copy above carries the message.
- **Success screen** (`components/EmployerForm.tsx:96-110`): keep the check
  and the headline; body `Te contactamos por WhatsApp al {contactWhatsapp
  formatted} {hours copy}.`; then a green `WhatsAppCta intent="publicar"
  context={{ jobTitle, companyName }}` labelled `¿Querés acelerarlo? Escribinos
  ahora` — the prefilled message carries the job title and company so the
  chat starts with context and the team can match it to the pending row.
  Under it a quiet line: `Mientras tanto: <a href="/planes">mirá cómo
  destacar tu aviso</a>`.
- Self-serve band (`page.tsx:43-52`) stays exactly as is, gated on both
  flags; when it shows, it becomes the third card, last.
- **Fix the double write** (finding 7): `app/api/publicar/route.ts` schema
  accepts `contactName` + `email` (optional); `createPublicJobSubmission()`
  records them in the `activity_log` meta of the submission row (no schema
  change — `jobs` has no contact-person column and should not grow one).
  The client sends the full payload to both endpoints. A non-OK from
  `/api/publicar` is still swallowed for the user but now `captureException`'d
  (Sentry exists since PR #72).
- Metadata: title `Publicá tu empleo gratis en Paraguay — por WhatsApp o
  formulario`; description updated to say WhatsApp.

#### W4 — `/contacto`, `/planes`, dashboard: same pattern everywhere

- `/contacto`: WhatsApp tile becomes a `WhatsAppCta variant="button"
  intent="contacto"` (tracked, green, hours copy); the message becomes
  `Hola, tengo una consulta sobre trabajo.com.py.` with a second tracked
  pill `Quiero publicar un empleo` (`intent="publicar"`) — the page's own
  subhead already says `¿Tenés preguntas o querés publicar un empleo?`.
  The "Formulario — Respondemos en 24 horas" tile uses `WHATSAPP_HOURS_COPY`.
- **`ContactForm` stops posting fake jobs**: add a `contact` member to the
  `leadSchema` discriminated union in `lib/leads.ts` (`type: 'contact'`:
  name, phone, email?, message, sourcePage) → `buildPayload` emits
  `lead_type: 'contact'` with empty job fields. Additive; the GHL workflow
  branches on `lead_type` already. Add `HoneypotField`. `README.md` lead
  table gains the third `lead_type`.
- `/planes`: Destacado CTA → `WhatsAppCta intent="destacado"` (green now;
  message unchanged). Empresa `Hablemos` → `WhatsAppCta intent="empresa"`
  (§7 D5). Básico `Publicar gratis` → `/publicar`
  unchanged. Fix `Activo por 30–60 días` to match what `FeaturePanel`
  actually sells (15/30/60/90 — say `Activo por el período que elijas: 15,
  30, 60 o 90 días`). FAQ item "¿Cómo publico?" rewritten to name WhatsApp
  first.
- `components/empresa/PlanCard.tsx` renew link → `WhatsAppCta variant="link"
  intent="renovar" context={{ companyName }}`.
- `/publicar` and `/planes` each get a `FloatingWhatsApp` (§7 D2).

#### W5 — team notification for employer leads (closes finding 4)

- `lib/email.ts` gains `sendEmployerLeadNotification(lead)` → to
  `LEADS_NOTIFY_EMAIL` (new env; unset = log-and-skip, per the E1 rule).
  Subject `Nuevo pedido de publicación: {jobTitle} — {companyName}`. Body:
  every field the employer typed, the `wa.me` link to *their* number
  (`waHref(contactWhatsapp, 'Hola {contactName}, te escribimos de
  trabajo.com.py por el aviso "{jobTitle}"…')`) so the operator taps once
  to open the conversation, and a link to the pending row in
  `/admin/empleos`. Also for `type: 'contact'` leads with a different
  subject. Sent inside the existing `after()` in `/api/v1/leads` after the
  webhook fan-out; a send failure never fails the submission.
- `/admin` dashboard: the pending-queue card already exists; add a line
  `Último pedido de publicación: {relative time}` so a missed notification
  is visible on the panel (same idea as O2's purge timestamp).
- `.env.example` + `DEPLOY.md` env table + README.

Batch W exit state: every employer-intent surface offers WhatsApp first in
green, with intent-named prefilled messages, tracked as `whatsapp_click`
`{audience:'employer', intent}`; the form remains as the honest second path;
the team is emailed on every lead; `whatsapp:verify` guards the number.

**Copy rules for Batch W (owner decision D1, §7):** the site never promises
applicant volume or speed. Allowed: what the product does ("los postulantes
te escriben directo a tu WhatsApp", "publicación gratis", "revisamos y
publicamos"). Not allowed: "postulantes en minutos", "cientos de
candidatos", any number of applicants. The team's own response time is a
promise the team can keep and is stated once, from one constant:
`WHATSAPP_HOURS_COPY = 'Te respondemos el mismo día hábil (lunes a viernes,
8 a 18).'` The `/contacto` tile's `Respondemos en minutos` and the
`/publicar` badge `⚡ Respuesta rápida` are replaced by that constant.

### Batch P — the launch promotion (job supply)

Owner decision (2026-09-08): **the first 100 approved listings get
Destacado for 90 days, free.** Básico is already free, so the promotion is
the *featured* window, which is the one thing the site sells. It rides
entirely on the existing `featured_until` machinery (`PLAN-PAGOPAR.md` §1)
and changes none of its rules: approval still happens only in `/admin`, the
grant still goes through `applyFeatureGrant()`, and the window arithmetic is
still `computeFeaturedUntil()`. What is new is a third channel, a quota, and
the public copy that disappears by itself when the quota is spent.

#### P1 — promotion core (Opus; touches the grant path and the approve transition)

- `FEATURE_GRANT_CHANNELS` gains `'promo_launch'` (`lib/db/admin.ts:370`).
  The grant records `amountGs: 0`, `method: 'promo'`, `note: 'Promoción de
  lanzamiento'`, `channel: 'promo_launch'` in the same `feature_grant`
  activity row every other channel writes, so "how many promo grants" is
  the same `activity_log` query as "how many sales".
- `lib/promo.ts` (server-only): `LAUNCH_PROMO = { quota: 100, days: 90 }`
  as constants; `launchPromoEnabled()` reads `LAUNCH_PROMO_ENABLED` with the
  exact-`"true"` rule from `lib/flags.ts` (so ending it early is a dated
  hPanel decision, and unset = off, the same as every other flag);
  `getLaunchPromoStatus(): { enabled, quota, granted, remaining }` where
  `granted` counts `feature_grant` rows with `channel = 'promo_launch'`
  (one per job — the grant path refuses a second promo grant on the same
  job id). Cached under a new tag, invalidated by the grant. Seed mode:
  `granted = 0`.
- **Where the grant happens:** in the admin PATCH handler
  (`app/api/admin/empleos/[id]/route.ts`) when the request transitions
  `status` to `published` *from* `pending` or `draft` and carries
  `applyLaunchPromo: true`, and the promo is enabled with `remaining > 0`.
  The status write and `applyFeatureGrant(id, actor, { days: 90, extend:
  false, channel: 'promo_launch', … })` run in one transaction; the quota
  check is inside it. The grant never happens on create, on the employer
  path, or on `/api/publicar` — **the promotion is applied by a human at
  approval, which is the moment the listing earns it.** `moderation:verify`
  gains a source assertion that `'promo_launch'` appears in exactly one
  write path and that path is the admin status handler; `featured:verify`
  is unchanged (the arithmetic is unchanged).
- Admin UI (`components/admin/JobForm.tsx` or the approve control): a
  checkbox `Aplicar promoción de lanzamiento (Destacado 90 días, gratis) —
  quedan {remaining} de 100`, default **checked** while eligible, hidden
  when the promo is off, spent, or the job already had a promo grant. The
  `FeaturePanel` shows `Promoción de lanzamiento` as the channel on the
  existing grant history. `/admin` dashboard: `Promoción: {granted}/100`.
- Expiry: `jobs.expiresAt` is nullable and no UI sets it today, so a
  90-day window never outlives the listing. P1 adds nothing there; if S3's
  optional "Vence el" field lands later, the grant path extends `expiresAt`
  to at least `featuredUntil` when it is shorter — write that rule now in
  `applyFeatureGrant()` so both channels get it.
- `/terminos`: a "Promoción de lanzamiento" clause — one grant per aviso,
  applied only to listings approved by the team, no cash value,
  non-transferable, the team may end the promotion when the 100 are spent
  or at any time; renewals after the 90 days at the published price.

#### P2 — promotion surfaces (Sonnet; after P1 and W1)

Every surface reads `getLaunchPromoStatus()` and renders **nothing** when
`enabled` is false or `remaining` is 0, so no PR is needed to end it.

- `/planes`: a promo strip above the plan grid — `Promoción de lanzamiento
  · Los primeros 100 avisos aprobados salen destacados 90 días, gratis ·
  Quedan {remaining}` — and on the Destacado card the price line reads
  `Gratis para los primeros 100 avisos` with `Consultar` as the after-promo
  price under it. The card's CTA stays `WhatsAppCta intent="destacado"`; the
  prefilled message adds `(promoción de lanzamiento)` while active.
- `/publicar`: the same strip under the `h1`; the WhatsApp card's message
  becomes `Hola, quiero publicar un empleo con la promoción de lanzamiento
  (Destacado 90 días gratis).` while active.
- Homepage band: the second line from W2.
- `lib/whatsapp.ts`: the `publicar` and `destacado` messages take a
  `promoActive` boolean so the copy is decided in one place.
- The W5 notification email gets a line `Promoción de lanzamiento: quedan
  {remaining}` so the operator sees the quota while replying.
- Employer dashboard `PlanCard`: `Destacado activo hasta {date} · Promoción
  de lanzamiento` when the active grant's channel is `promo_launch`, with
  `Renovar por WhatsApp` unchanged.

### Batch S — SEO structural fixes (Opus where marked)

#### S1 — metadata hygiene pass (Sonnet)

- `alternates.canonical` on every public page: `/`, `/empleos` (bare, see
  S2), `/empleos/[slug]`, both `/trabajo` levels, `/blog`, `/publicar`,
  `/planes`, `/contacto`, legal pages. Absolute, from `metadataBase`.
- Homepage `metadata`: own title (`Empleos en Paraguay — trabajo.com.py`
  style, owner may tune), description, canonical; `Organization` JSON-LD
  (name, url, logo → the `app/icon.svg` absolute URL, no `sameAs` (§7 D9), `contactPoint` with the WhatsApp number as `telephone` and
  `contactType: 'sales'`) and `WebSite` with `SearchAction` targeting
  `/empleos?q={search_term_string}`.
- `twitter: { card: 'summary_large_image' }` in the layout default.
- Taxonomy titles: stop `.toLowerCase()` on names; use `cityLabel()` in
  `/empleos` title; intro copy uses the true total (`getJobs().total`).
- `<time dateTime>` on JobCard, job detail, blog card and blog header.
- `app/sitemap.ts`: import `JOBS_PAGE_SIZE`; real `lastModified` for
  taxonomy pages (max `updatedAt` of their jobs, computed from the same walk)
  and drop `new Date()` for static pages (omit the field).
- `lib/cache.ts`: `invalidateBlogContent()` also revalidates `/sitemap.xml`.
- **`capiatá` → `capiata`** in `lib/seed/cities.json`, a `redirects()`
  entry in `next.config.ts` for `/trabajo/:categoria/capiatá` (both the
  literal and the percent-encoded form) → `/trabajo/:categoria/capiata`
  (301), plus `/empleos?ciudad=capiatá`. The DB row is renamed by
  `scripts/seed-import.ts` upsert-by-slug semantics — check it updates
  rather than duplicates; if it inserts, the PR ships a one-off migration.
  `parity-check` green.
- `robots.ts`: add `disallow: ['/empleos?*']`? **No** — leave crawlable and
  let S2's canonical/noindex do the work; a robots block would hide the
  noindex. Do add `/api/`-style protection for nothing new. (Keep the
  `/empresa/` prefix; a future public company page lives at `/empresas/`
  and is not matched.)

#### S2 — index control for `/empleos` (Opus)

Why Opus: a wrong canonical or noindex rule here removes the catalogue's
crawl paths; a wrong "indexable" rule multiplies duplicates. It also has to
be written against Next 16's metadata + `searchParams` docs.

Rule set, to be implemented in `generateMetadata` and asserted by
`scripts/verify-seo.ts` from source:

| URL shape | robots | canonical |
|---|---|---|
| `/empleos` | index | `/empleos` |
| `/empleos?page=N` (only `page`) | index | self (`/empleos?page=N`) |
| `/empleos?categoria=X` (only categoria [+page]) | noindex, follow | `/trabajo/X` |
| `/empleos?categoria=X&ciudad=Y` (only those [+page]) | noindex, follow | `/trabajo/X/Y` |
| `/empleos?ciudad=Y` (only ciudad [+page]) | noindex, follow | S4's city landing `/trabajo-en/Y` (until S4 lands: `/empleos`) |
| anything with `q`, `tipo`, `nivel`, `modalidad`, `salario_min`, `orden` | noindex, follow | `/empleos` |

- Add the missing `h1` (`Empleos en Paraguay`, or `Empleos de {categoría}
  en {ciudad}` when those two filters are set — the visible page finally
  says what it lists).
- Remove the `relevancia` sort option (it is `recientes` under another name)
  and treat `orden=destacados` as the default order it already is: fewer
  URL permutations, no behaviour change. Keep `salario`.
- A server-rendered **"Explorá por categoría / por ciudad"** link block at
  the bottom of `/empleos` (all 10 categories → `/trabajo/*`, all cities →
  S4 landings or, until S4, `/empleos?ciudad=`), so the listing feeds the
  crawlable tier.
- `<Suspense>` boundaries around `SearchBar`, `FilterPanel`, `SortControl`
  (Next 16 requires it for `useSearchParams` in static contexts — check the
  docs; the route is dynamic today so this is hygiene, not a fix).
- `scripts/verify-seo.ts` + `npm run seo:verify` + CI step: source
  assertions that every public `page.tsx` under `app/` (excluding
  `/admin`, `/empresa`, `/postulante`) exports `alternates` in its metadata;
  that `/empleos` metadata references the rule table's helper; that
  `validThrough` (S3) is derived from `expiresAt` and the literal
  `featuredUntil` does not appear in the JSON-LD block.

#### S3 — JobPosting correctness + the closed-job tombstone (Opus)

Why Opus: it adds a field to the public `Job` type (both readers, parity), a
new seam function that deliberately reads *outside* the visibility predicate,
and changes what an expired URL serves. Each of those is a place a subtle
mistake either leaks an unapproved job or deindexes approved ones.

- `Job.expiresAt: string | null` added to `lib/types.ts`; seed JSON gets the
  optional field (README table updated); DB reader maps `jobs.expiresAt`.
  `parity-check` + `jobs:verify` green.
- JSON-LD: `validThrough` = `expiresAt` when set, else omitted (Google
  accepts a missing `validThrough`; it does **not** accept a wrong one).
  `directApply: true` (the page has the form and the WhatsApp button).
  `identifier: { '@type': 'PropertyValue', name: 'trabajo.com.py', value:
  slug }`. `description` = `renderMarkdown()`-style HTML — reuse whatever
  `components/MarkdownContent.tsx` renders, server-side, escaped;
  **do not** hand the blog renderer to job descriptions without checking
  the two Markdown implementations' documented split
  (`MarkdownContent.tsx:25-36`). `hiringOrganization.sameAs` when the
  company has a `website` (requires `Job.companyWebsite` — add it the same
  way as `expiresAt`, or defer and say so in the PR body).
- **Tombstone.** New seam function `getClosedJob(slug)` in `lib/data.ts`
  returning `{ title, categorySlug, citySlug, company, closedAt } | null`
  **only** for jobs whose status is `published` with `expiresAt <= NOW()`
  or `archived` — never `draft`, `pending`, `rejected`. Seed implementation:
  same rule over `expiresAt`. DB implementation lives beside
  `visiblePredicate()` with a comment saying exactly why it is the one read
  that steps outside it, and `scripts/verify-moderation.ts` gains an
  assertion that the function's WHERE names only `published` and `archived`.
  Page behaviour: when `getJob()` is null and `getClosedJob()` is not →
  render `app/empleos/[slug]/closed.tsx`-equivalent content in the same
  route: HTTP 200, `robots: { index: false, follow: true }`, `h1` `Esta
  oferta ya no está disponible`, the job title and company as text, no
  description, no apply CTA, **no `JobPosting` JSON-LD**, then the existing
  "Empleos similares" block (`getJobs` by category, fallback city) and a link
  to `/trabajo/{cat}` and the city landing. Both null → `notFound()` as
  today. Decided (§7 D6): the tombstone, because it keeps the visitor and the
  internal links.
- `generateStaticParams` walks every page (same loop as the sitemap; factor
  `getAllJobs()` into `lib/data.ts` as `getAllPublishedJobSummaries()` or
  reuse the sitemap's) so every approved job is prerendered at build. Check
  the build-worker cap from PR #82 still holds the build time; if not,
  prerender the most recent 100 and let the rest be on-demand — state which
  in the PR body.
- `app/not-found.tsx`: add a search box (the existing `SearchBar`) and the
  category link block from S2 so a true 404 is not a dead end.

#### S4 — city landings `/trabajo-en/[ciudad]` (Sonnet, after S2)

- New route `/trabajo-en/[ciudad]` (URL chosen for the query shape "trabajo
  en Asunción"; §7 D7). `generateStaticParams` from `getCities()`.
  Title `Trabajo en {City} — empleos en {City}, Paraguay`; `h1` `Trabajo en
  {City}`; intro copy per city from a static `lib/seo/city-copy.ts` map
  (Spanish, 2–3 sentences each, written by the PR — Asunción, Ciudad del
  Este, Encarnación, San Lorenzo, Luque, Capiatá, Lambaré); a "Por
  categoría" chip row linking `/trabajo/{cat}/{city}` for every category
  with a job in that city (counts from S5's seam function); paginated job
  list; `BreadcrumbList` + `ItemList`; `noindex` when empty; sitemap entry.
- Footer city links → `/trabajo-en/{city}`, all 7 cities, all 10 categories
  (two columns become link lists; keep it compact).
- Homepage gets an "Empleos por ciudad" block (D1 restyles it; S4 ships it
  plainly).
- Job detail: city label in the header links to `/trabajo-en/{city}`, and the
  sidebar "Más empleos en {categoría}" card gains `… en {city}` →
  `/trabajo/{cat}/{city}`.

#### S5 — taxonomy landings: static, paginated, cross-linked (Sonnet)

- New seam function `getTaxonomyCounts({ categoria?, ciudad? })` returning
  `{ cities: { slug, name, jobCount }[], categories: {...}[] }` for the
  published, non-expired set under that filter — the DB version one
  grouped query, seed version a reduce; `parity-check` extended. This
  replaces the page-1-derived chips (§3.6) so every non-empty city is linked
  from its category page.
- `generateStaticParams` on both `/trabajo` levels (categories ×
  cities from the two JSON/DB lists; empty combos are cheap and `noindex`).
- Pagination with `components/Pagination.tsx` (`?page=N`, canonical self,
  first page bare) on both levels and on S4.
- Per-category editorial intro from `lib/seo/category-copy.ts` (10 entries,
  2–3 sentences, what the roles are, typical requirements, no invented
  numbers) — the same file Batch C's "guías por sector" articles link from.
- Cross-link blocks at the bottom of both levels: "Otras ciudades" (sibling
  cities for that category), "Categorías relacionadas" (a static
  adjacency map in `category-copy.ts`: contabilidad ↔ administracion ↔
  atencion-al-cliente; ventas ↔ marketing; logistica ↔ construccion; etc.),
  and, once C2 lands, "Consejos para conseguir trabajo en {categoría}"
  (blog posts with `relatedCategorySlug = cat`).
- `[ciudad]/generateMetadata` reuses the page's query result (or the counts
  function) instead of a second `getJobs`.
- The category page's terminal CTA → `/empleos?categoria=` is removed
  (pagination replaces it).

#### S6 — performance hygiene (Sonnet, small)

- Job photos and logos: keep `<img>` per `PLAN-IMAGES.md` §6 but add
  `width`/`height` (or `aspect-video` + intrinsic size from the stored
  variant), `loading="lazy"`, `decoding="async"` on everything below the
  fold. No `next/image` adoption — the images are already WebP at known
  sizes and the doc explains why.
- Drop the `zod` import from `components/LeadForm.tsx`, `EmployerForm.tsx`,
  `ContactForm.tsx` in favour of a tiny hand validator mirroring the server
  schema (the server is the authority anyway); measure the public JS delta
  in the PR body.
- Move the inline `<style>` block from the job page into
  `app/globals.css` under `.prose-job`.
- `SearchHero` chips → `Link`. Sentry client: set `tracesSampleRate: 0`
  and `replaysSessionSampleRate: 0` if not already (check
  `instrumentation-client.ts`) — errors only.
- No font changes: Inter via `next/font` with `display: swap` and the
  default `adjustFontFallback` is already the right configuration.

### Batch C — blog as a content engine

Ordered so that archives arrive **after** the content that fills them,
honouring `PLAN-PHASE3-DRAFT.md` §5.3. C1 is a schema PR; C0 is content
production and runs in parallel with Batch S.

#### C0 — the first content sprint (Sonnet content subagents; owner edits)

Decided model (§5.2 of the draft): AI draft + owner edit. Each article is a
Sonnet subagent with the brief below, output pasted into `/admin/blog` by
the owner (or committed as Markdown and pushed through `blog:import` if the
owner prefers batch — both paths exist). **Content rules** from
`content/blog/README.md` apply verbatim: no unsourced numbers, no
first-person legal advice, no candidate data. Legal/labour articles cite the
Código del Trabajo article number or the IPS/MTESS source they rely on, and
carry the standing line `Esta nota es informativa y no reemplaza el
asesoramiento de un profesional.`

Topical clusters (categories are C1's set; slugs are proposals):

| Cluster / category | Pillar article | Supporting articles (first sprint) | Links to |
|---|---|---|---|
| **Consejos de CV** (`consejos-cv`, exists) | Cómo escribir un CV en Paraguay (exists) | CV sin experiencia; carta de presentación; qué poner en "objetivo"; plantilla de CV para {ventas, atención al cliente, logística} | `/trabajo/{cat}` |
| **Entrevistas** (`entrevistas`, new) | Cómo prepararte para una entrevista (exists, recategorised) | 20 preguntas frecuentes y cómo responderlas; entrevista por WhatsApp/videollamada; qué preguntar vos; después de la entrevista | `/empleos` |
| **Derechos laborales** (`derechos-laborales`, new) | Tus derechos al empezar un trabajo en Paraguay (contrato, IPS, período de prueba) | Aguinaldo: quién cobra y cuándo; vacaciones por ley; salario mínimo (fuente MTESS, sin cifra hardcodeada en el título); horas extra; liquidación al renunciar/despido; IPS: qué cubre | `/trabajo/*` (contextual) |
| **Mercado laboral** (`analisis-laboral`, exists, label → "Mercado laboral") | Qué rubros contratan más en Paraguay (from the site's own category counts — the only number the site can source itself) | Trabajo remoto desde Paraguay; empleos sin experiencia: dónde buscar; trabajar en Ciudad del Este / Encarnación (city pillars) | `/trabajo-en/{city}`, `/trabajo/{cat}` |
| **Guías por sector** (`guias-por-sector`, new) | one "Cómo conseguir trabajo en {categoría}" per job category, 10 in total, each with `relatedCategorySlug` set | — | `/trabajo/{cat}` (required) |
| **Noticias** (`noticias`, exists) | — | Only when there is news; not a filler category | — |
| **Para empresas** (`para-empresas`, new) | Cómo publicar un aviso de empleo que reciba postulantes por WhatsApp | Cómo escribir un aviso claro; qué preguntar en la primera respuesta por WhatsApp; cuándo destacar un aviso | `/publicar`, `/planes` (the employer funnel gets an SEO front door) |

Sprint size: ~20 articles (the 10 sector guides + 2 per other cluster).
Each: title, ≤160-char description, 700–1200 words, `h2`s, one internal
link to a landing in the first 200 words, `relatedCategorySlug` (+ city
where natural), and a cover image request for the owner's image pipeline
(not in scope here). Keyword targets are in the article briefs, one primary
per article; no keyword stuffing, voseo, Paraguay-specific vocabulary
(`aguinaldo`, `IPS`, `MTESS`, `planilla`, `changa`).

#### C1 — blog schema: categories as one source, index, migration (Sonnet)

- Extend `blogCategoryEnum` to `noticias | analisis-laboral | consejos-cv |
  entrevistas | derechos-laborales | guias-por-sector | para-empresas`
  (§7 D4). Drizzle migration altering the enum; **no rename of
  existing values** (`analisis-laboral` keeps its value, only its label
  changes to "Mercado laboral", so no URL moves).
- Single source: `lib/blog-categories.ts` exports the tuple, the labels,
  and per-category `{ title, description, intro }` copy for archives;
  `lib/db/schema.ts` imports the tuple for the enum; `lib/blog.ts`
  re-exports; `BlogPostForm.tsx` renders from it (delete its private copy).
  `verify-blog.ts` asserts there is exactly one array literal of category
  slugs in the repo.
- Index `category_published_idx (status, category, published_at)`.
- `cascade:verify` unaffected (no new table). Retention stance: unchanged.

#### C2 — archives, pagination, related posts, linking surfaces (Sonnet; after C0 ≥ threshold)

Gate: ≥5 published posts across ≥2 categories in production (§5.3), which
C0 satisfies within its first week.

- `lib/db/blog.ts`: `queryPublishedPosts({ category?, page, pageSize })`
  returning `{ posts, total }`, `queryRelatedPosts(slug, category, limit)`,
  `queryPostsForJobCategory(relatedCategorySlug, limit)` — all behind
  `publishedPredicate()`; `lib/blog.ts` wraps them with the same
  `cachedOrRaw` + tag pattern. `verify-blog.ts`'s "every public export
  contains `publishedPredicate()`" assertion covers them automatically.
- `/blog` → 12 per page, `?page=N`, `Pagination`; category pills become
  links; cards show the cover thumbnail (lazy, sized).
- `/blog/categoria/[categoria]`: `h1` + intro from `lib/blog-categories.ts`,
  paginated list, `BreadcrumbList` + `ItemList`, canonical, `noindex` when
  empty (mirrors the jobs convention), sitemap entries.
- `/blog/[slug]`: "Artículos relacionados" (3, same category, exclude self,
  omitted when empty); prev/next by date optional; JSON-LD adds
  `articleSection`, `inLanguage: 'es-PY'`, `publisher.logo`; byline `Equipo de
  trabajo.com.py` (§7 D8), Organization author unchanged.
- Heading ids: `marked` heading renderer adds a slugified `id`; an optional
  "En esta nota" TOC for articles with ≥4 `h2`s.
- **Linking surfaces** (the point of the batch):
  - Header nav `Consejos`, footer `Blog` (§7 D4).
  - Job detail: `Consejos para postularte` block under the description —
    2 posts via `queryPostsForJobCategory(job.categorySlug)`, fallback 2
    latest `consejos-cv`.
  - `/trabajo/[categoria]` (+ city): `Cómo conseguir trabajo en {cat}` block
    — the sector guide first, then 2 more.
  - Homepage: `Consejos para conseguir trabajo` — 3 latest posts (D1 styles).
  - `/publicar` and `/planes`: 2 `para-empresas` posts as a quiet "Leé más"
    row under the cards.
  - Blog article: the existing related-jobs footer stays; the intro
    paragraph's landing link is editorial (C0 brief) and the category
    archive link is in the breadcrumb.
- `invalidateBlogContent()` revalidates the new archive paths + job detail
  + taxonomy paths (they now embed posts) — or, cheaper, tag those reads
  with `public-blog` too. Opus is not needed; follow `lib/cache.ts`'s
  existing pattern and the Next 16 docs.

#### C3 — admin ergonomics for the content cadence (Sonnet, small)

- `BlogPostForm`: `relatedCategorySlug` required when category is
  `guias-por-sector` (server-side in `schema.ts` too); slugs validated
  against the taxonomy (`listCategoryOptions()`), not just shape.
- `/admin/blog` list: category filter, and a "Sin empleos relacionados"
  badge for posts with both related slugs null.
- Draft → published → renamed edge (§3.7): mint the redirect whenever the
  *previous row was ever published* — simplest correct rule: mint on any
  slug change where `previous.publishedAt` is not null.

### Batch D — redesign direction (Sonnet; after W and S1–S4)

The direction, not a pixel spec: the build session takes it with
`web-design-system`-style discipline (tokens first, then components, then
pages) and posts screenshots in each PR. Visual identity stays — brand red,
gold accent, warm paper surfaces, the ñandutí motif; the change is
hierarchy, mobile order and consistency.

#### D1 — design tokens and primitives (zero-visual-diff first, then the gold)

- Promote to tokens: the CTA gold (§7 D3: `#E6B25A` is `--color-gold`;
  `#B0812C` becomes `--color-gold-deep` for text on light backgrounds), `--color-surface-featured` (`#FBF3E0`/`#FDF8EC` — pick one),
  `--color-border-featured` (`#EDDCB4`), `--color-ink-prose` (`#44403A`),
  the avatar palette. Replace literal hexes mechanically; use
  `rounded-card` / `rounded-sm` tokens (set `--radius-card 12px` to match
  the majority usage, or keep 14 and accept the diff — say which).
- `components/ui/Button.tsx` with variants `primary` (brand), `gold`,
  `whatsapp`, `outline`, `ghost` and sizes; `WhatsAppCta` composes it. Card
  primitive with the two elevations used on the site. All new W/S pages
  already use `WhatsAppCta`, so this is a mechanical swap.
- JobCard title → `h3`; the card gets one consistent tap target (whole
  card is the link, which it already is) at ≥44 px min-height on mobile;
  the featured variant reads as featured on a 360 px screen (badge, not
  only a border colour).

#### D2 — job detail, mobile-first

- **Sticky bottom apply bar on `< lg`**: appears once the header's
  WhatsApp button scrolls out (IntersectionObserver in a small client
  component), holds `Postulate por WhatsApp` (green, full width) and a
  compact `Formulario` secondary that scrolls to the form; `env(safe-area-
  inset-bottom)` padding; hidden when the form is in view. Fires the same
  `whatsapp_click` (`audience: 'seeker'`) via the shared module.
- Reorder for mobile: title + company + city/salary/contract chips → the
  apply card **once, at the top** (WhatsApp, form link, login-to-apply when
  flag on) → description → similar → share. On `lg` the sidebar stays.
- Company block: logo, name, `Ver otros empleos de {company}` (a filtered
  `/empleos?empresa=` is *not* added — it would be another uncanonicalised
  surface; instead, D5's company page, or omit the link until then).
- Salary presentation: `A convenir` when hidden, `No informado` when both
  null (the formatter already distinguishes the inputs; the copy does not).
- Freshness: `Publicado {relative}` + `Actualizado {relative}` only when
  they differ; `<time>` from S1.
- `navigator.share` on mobile in `ShareLinks` when available, with the
  existing links as fallback.

#### D3 — homepage for two audiences

Order on mobile: compact hero (`h1`, one-line search with the city select
folded into a second row *only* after the input gains focus, or a single
"Buscar empleos" button that opens `/empleos` — pick after a build-and-look;
the requirement is one fewer stacked control) → "Últimos empleos" (freshness
is the seeker's signal; 6 cards) → "Explorá por categoría" (5-col grid
becomes a 2-col list on mobile with counts) → "Empleos por ciudad" (S4) →
"Destacados" (moves down; it is a paid slot, not the seeker's first need —
§7 D10) → "Consejos para conseguir trabajo" (C2, 3 cards) → the
employer band from W2 → footer. Add a one-line trust strip under the hero
using only numbers the site can source (`{n} empleos activos · {m}
categorías · gratis para postulantes`). No stock photography; the motif and
type carry the page (LCP stays text).

#### D4 — listing page

`h1` (S2), 2-col results at `md`, filter trigger at ≥44 px, drawer with
`role="dialog"`, `aria-modal`, focus trap, Escape; active-filter chips above
results with an ✕ each (server-rendered links to the URL minus that param —
which also makes filter *removal* crawlable); empty state with three
suggestions derived from the current filters (drop city, drop category, see
all) as real links.

#### D5 — public company pages `/empresas/[slug]` (§7 D11: yes)

Logo, name, description, website (`nofollow`), the company's published jobs
via `getJobs({ empresa })` — a new seam filter — `Organization` JSON-LD,
`noindex` while the company has no published job, sitemap when it does.
Robots' `/empresa/` prefix does not match `/empresas/`. No contact details
of the company are shown beyond what the job pages already show. This is
the answer to "Ver otros empleos de {company}" in D2 and to brand-name
queries, which are a meaningful share of job-board organic traffic.

---

## 5. Measurement (so the owner can tell if it worked)

- GA4 conversions: mark `whatsapp_click` (both audiences, split by
  `audience` + `intent` as custom dimensions) and `lead_submit`. Before W1
  lands, note the baseline: employer WhatsApp taps are **unmeasurable
  today**, so the first comparable number exists two weeks after W4.
- Search Console: verify the property (DNS record or the HTML file in
  `public/`), submit `/sitemap.xml`, and export the "Pages" report before
  S2/S3 merge — that is the baseline for indexed count, `noindex` count,
  and the "Crawled, currently not indexed" bucket the filtered URLs are
  probably in.
- Job-posting rich results: Search Console's "Job postings" enhancement
  report before and after S3 (`validThrough` errors should go to zero).
- Blog: `/blog/*` sessions and landing-page entries by category archive,
  monthly; the C0 sprint's articles are the cohort.

---

## 6. Order, dependencies, model per PR

Owner decision (2026-09-08): **one Opus session first, then one Sonnet
session per window, each driven by a single prompt** (§10). The Opus
session takes every PR where a wrong line leaks an unapproved job, deindexes
the catalogue, or grants a Destacado outside the approval path; it runs
first so that the Sonnet windows never touch those files. The Opus PRs were
made self-sufficient for that: S2 creates the canonical helper that S1 later
applies everywhere, and S3 carries its own `expiresAt` plumbing.

| Session | # | PR | Depends on | Size |
|---|---|---|---|---|
| **Opus** ✅ | 1 | P1 launch-promotion core — **merged, PR #85** | — | M |
| **Opus** ✅ | 2 | S3 JobPosting fix + closed-job tombstone + full prerender — **merged, PR #86** | — | M |
| **Opus** ✅ | 3 | S2 `/empleos` index control + `lib/seo.ts` + `seo:verify` — **merged, PR #87** | — | M |
| **Sonnet A** | 4 | W1 shared WhatsApp module + event vocabulary + `whatsapp:verify` | — | S |
| Sonnet A | 5 | W2 homepage band, mobile menu, footer, floating button | W1 | S |
| Sonnet A | 6 | W3 `/publicar` two paths + success screen + double-write fix | W1 | M |
| Sonnet A | 7 | W4 `/contacto` lead type, `/planes`, PlanCard | W1 | S |
| Sonnet A | 8 | W5 team lead-notification email | W4 | S |
| Sonnet A | 9 | P2 promotion surfaces | P1, W1 | S |
| **Sonnet B** | 10 | S1 metadata hygiene (uses `lib/seo.ts`) + `capiatá` 301 | S2 | M |
| Sonnet B | 11 | S5 taxonomy counts seam + static + paginated landings | S2 | M |
| Sonnet B | 12 | S4 city landings `/trabajo-en/[ciudad]` | S5 | M |
| Sonnet B | 13 | S6 performance hygiene | — | S |
| Sonnet B | 14 | C1 blog category schema | — | S |
| **Sonnet C** | — | C0 content sprint: ~20 articles as parallel subagents, one PR of Markdown under `content/blog/drafts/` for the owner to paste/import | C1 | L |
| Sonnet C | 15 | C2 archives, related posts, linking surfaces | C1, ≥5 posts live | L |
| Sonnet C | 16 | C3 admin ergonomics | C2 | S |
| **Sonnet D** | 17 | D1 tokens + primitives | W done | M |
| Sonnet D | 18 | D2 job detail mobile-first + sticky bar | D1, S3 | M |
| Sonnet D | 19 | D3 homepage | D1, S4, C2 | M |
| Sonnet D | 20 | D4 listing page | D1, S2 | M |
| Sonnet D | 21 | D5 company pages `/empresas/[slug]` | D2 | M |

**Update 2026-09-08, after the Opus session:** PRs 1–3 are merged (§12 is
what they left behind). Sonnet A and Sonnet B run **back to back in one
session** at Sonnet *high* effort — eleven PRs, unattended, each a
production deploy, and every red CI run is billed; the extra reasoning per
PR is cheaper than one re-push. Sonnet C starts after Sonnet B's C1 merges and
after the owner has published at least five articles from the C0 drafts.
Sonnet D starts after A, B and C2 are merged. Every session: PR → CI green
→ merge → pull `main` → next, never stacked; auto-merge on green with the
standing exception (production env, rollback paths, anything not in the PR's
section stops for the owner).

Why exactly three Opus PRs: P1 writes `featured_until` from a new channel
inside the approval transition; S3 adds a read that deliberately steps
outside the visibility predicate; S2 decides which catalogue URLs Google
may index. Everything else is mechanical against this spec.

---

## 7. Decisions (owner, 2026-09-08 — "go with the recommendations")

Every question from the first draft of this plan is answered; the build
sessions read this table, not the defaults that used to sit here.

| # | Decision |
|---|---|
| **D1** | **No promise of applicant volume or speed anywhere on the site.** The site does not yet have the traffic to keep "postulantes en minutos", so the copy describes what the product does, never how fast candidates arrive. The team's own response time is stated once: `Te respondemos el mismo día hábil (lunes a viernes, 8 a 18).` (`WHATSAPP_HOURS_COPY`). |
| **D2** | Floating WhatsApp button on employer pages only: `/`, `/publicar`, `/planes`, `/contacto`, labelled `¿Publicás un empleo?`. Never on `/empleos*`, `/trabajo*`, `/blog*`. |
| **D3** | Gold: `#E6B25A` is the button gold (`--color-gold`), `#B0812C` becomes `--color-gold-deep` for text and badges. |
| **D4** | Blog categories: add `entrevistas`, `derechos-laborales`, `guias-por-sector`, `para-empresas`; relabel `analisis-laboral` → "Mercado laboral" (value unchanged). Header label `Consejos`, footer label `Blog`. |
| **D5** | Plan Empresa CTA → WhatsApp (`intent="empresa"`). |
| **D6** | Expired job URL → tombstone: HTTP 200, `noindex, follow`, title + company, similar jobs, no `JobPosting`. |
| **D7** | City landings at `/trabajo-en/[ciudad]`. |
| **D8** | Byline `Equipo de trabajo.com.py`; JSON-LD author stays the Organization. |
| **D9** | No public email, no social profiles in Organization JSON-LD or footer. WhatsApp is the contact channel. |
| **D10** | Homepage: "Últimos empleos" above "Destacados"; Destacados stays above the fold on desktop. |
| **D11** | Public company pages `/empresas/[slug]`: yes, after D2. |
| **D12** | `EMPLOYER_SIGNUP_ENABLED`: the code keeps gating the self-serve card on both flags; §11 recommends the owner flips both flags on as part of the supply push. |
| **D13** | `LEADS_NOTIFY_EMAIL`: owner sets it in hPanel; unset = log-and-skip. |
| **D14** | Content: ~20 drafts in the first sprint, then ~4/month; owner reviews; `derechos-laborales` articles stay drafts flagged `Revisión pendiente` until a lawyer has read them. |
| **D15** | **Launch promotion: the first 100 approved listings get Destacado for 90 days, free.** Batch P. Ends when the quota is spent or when the owner sets `LAUNCH_PROMO_ENABLED=false`. |
| **D16** | Sessions: one Opus session (P1, S3, S2), then one Sonnet session per window (A: W + P2; B: S1, S5, S4, S6, C1; C: content + C2, C3; D: D1–D5), each driven by one prompt from §10. |

## 8. Owner ops checklist (parallel, not PRs)

| When | Action |
|---|---|
| Now | Search Console: verify `trabajo.com.py`, submit the sitemap, export "Pages" + "Job postings" reports as the baseline |
| Now | GA4: confirm `NEXT_PUBLIC_GA_ID` is set in hPanel; after W1, mark `whatsapp_click` + `lead_submit` as conversions |
| Now | WhatsApp Business on the leads number: business profile (name, description, hours matching D1, website), out-of-hours greeting, quick replies for "precio Destacado", "cómo publico", "promoción de lanzamiento" |
| After P1 merges | Set `LAUNCH_PROMO_ENABLED=true` in hPanel, redeploy — the promotion is dark until then |
| After P1 merges | Flip `EMPLOYER_DASHBOARD_ENABLED=true` and `EMPLOYER_SIGNUP_ENABLED=true` (§11 step 2) — both were built for this |
| Before W5 verification | Set `LEADS_NOTIFY_EMAIL` in hPanel; Resend is already configured from E1 |
| After C1 | Paste the C0 drafts into `/admin/blog` (or `npm run blog:import -- --write` from `content/blog/drafts/`), set covers through the uploader, publish ≥5 across ≥2 categories so Sonnet C can ship C2 |
| After S3 | Search Console "Job postings" report two weeks later: `validThrough` errors → 0 |
| Weekly during the promo | `/admin` shows `Promoción: {granted}/100`; when it reaches 100, set `LAUNCH_PROMO_ENABLED=false` (the copy already disappears at 0 remaining; the flag stops further grants) |

## 9. Deliberately not in this program

- **Job alerts / saved searches** — still deferred (`PLAN-NEXT.md` §6).
- **Candidate search, ranking, matching, "X postulantes"** — `AGENTS.md`;
  nothing here reads candidate tables, and no blog or landing widget may.
- **Online payment** — `PLAN-PAGOPAR.md` is untouched; W4 only recolours
  and tracks the existing Destacado WhatsApp CTA.
- **WhatsApp Business API / chat widget SDKs / click-to-chat overlays** —
  plain `wa.me` links only. No third-party script, no cookie, no CSP change.
- **Lighthouse or bundle-size checks in CI** — the Actions budget rule. Run
  them locally and paste numbers in PR bodies where a PR claims a
  performance effect (S6).
- **`next/image` migration** — `PLAN-IMAGES.md` §6 explains the raw `<img>`
  decision; S6 adds the attributes that matter and stops there.
- **A second language, a second workflow, a tags taxonomy** — tags would
  create thin archive pages faster than content can fill them; the
  `relatedCategorySlug` bridge to the job taxonomy is the topical structure.
- **Automated content publishing** — every article passes through the owner
  in `/admin/blog`; no PR writes published rows.
- **Changing what "published" means, the moderation gate, the visibility
  predicate, or `featured_until` semantics.** S3's `getClosedJob()` reads
  *beside* the predicate for two explicitly named statuses and is asserted
  in CI; that is the whole extent of it.

---

## 10. Session prompts (one per session; paste as the first message)

All five share a preamble. Paste the preamble, then the session's block.

**Preamble (every session):**

> Read `AGENTS.md`, then `PLAN-GROWTH.md` in full — §1 (what binds you), §7
> (every decision is taken; do not re-ask), and your session's PRs in §4 as
> ordered in §6. This repo runs **Next.js 16**: run `npm install` first and
> consult `node_modules/next/dist/docs/` before writing metadata, caching,
> `searchParams`, route or image code. Work PR by PR: branch from a fresh
> `main`, build exactly what the PR's section says, keep `npm run build`,
> `npm run lint`, `npm run typecheck` and every `*:verify` script green
> locally before pushing, open the PR with a body listing pages touched
> (screenshots for visual changes from `npm run build && npm start`), wait
> for CI, merge on green, `git pull`, continue. Never stack PRs. UI copy is
> Spanish (Paraguay), voseo; §4's "Copy rules for Batch W" apply to every
> session: never promise applicant volume or speed. Anything that would
> touch production env, the visibility predicate, job status, `featured_until`
> outside what your PR section specifies, or a rollback path: stop and ask.
> When a PR section and the code disagree about a file:line, the code wins
> and you note the drift in the PR body. Do not use Fable for anything.

**Session 1 — Opus: done (PRs #85, #86, #87). Do not re-run.**

**Session 2 — Sonnet, effort HIGH (Batches W + P2 + S1/S5/S4/S6 + C1, eleven PRs, one session):**

> Read AGENTS.md, then PLAN-GROWTH.md in full — §1 (what binds you), §7
> (every decision is taken; do not re-ask), **§12 (what the Opus session
> left on `main` — rely on it, do not rebuild it)**, and your PRs in §4 as
> ordered in §6. This repo runs Next.js 16: run `npm install` first and
> consult `node_modules/next/dist/docs/` before writing metadata, caching,
> `searchParams`, route or image code.
>
> You are running Sonnet A and Sonnet B back to back (§6, PRs 4–14):
> **W1, W2, W3, W4, W5, P2, S1, S5, S4, S6, C1**, in that order. The owner
> is asleep — do not stop to ask unless a rule below says stop. Work PR by
> PR: branch from a fresh `main`, build exactly what the PR's §4 section
> says, keep `npm run build`, `npm run lint`, `npm run typecheck` and every
> `*:verify` script green locally before pushing, open the PR with a body
> listing pages touched (screenshots for visual changes from `npm run build
> && npm start`), wait for CI, merge on green, `git pull`, continue. Never
> stack PRs. New verify scripts are new steps in the existing job in
> `.github/workflows/ci.yml`, never a new workflow. UI copy is Spanish
> (Paraguay), voseo; never promise applicant volume or speed — the only
> time promise on the site is `WHATSAPP_HOURS_COPY`. Anything that would
> touch production env, the visibility predicate, job status,
> `featured_until` beyond what your PR section specifies, or a rollback
> path: stop and ask. When a PR section and the code disagree about a
> file:line, the code wins — note the drift in the PR body. Do not use Fable
> for anything.
>
> Batch W specifics: every `wa.me` link is built by `lib/whatsapp.ts` and
> nowhere else; `WHATSAPP_HOURS_COPY` and the intent messages (with their
> `promoActive` variant) live there; the floating button is mounted per page
> on `/`, `/publicar`, `/planes`, `/contacto` only, never in
> `app/layout.tsx`; W1's `.env.example` pass also adds `LAUNCH_PROMO_ENABLED`
> (§12, it is missing) and documents it in DEPLOY.md's env table; finish W
> with `whatsapp:verify` green in CI and README's analytics section
> documenting the two events. P2 gates every surface on
> `enabled && remaining > 0` from `getLaunchPromoStatus()` and never writes
> `'promo_launch'` anywhere (moderation:verify fails the build).
>
> Batch S specifics: S1 applies `canonicalFor()` from `lib/seo.ts` and owns
> titles/descriptions, not canonicals (all twelve public pages already
> declare one); keep `seo:verify` green. New seam functions in S5/S4
> (`getTaxonomyCounts`, the city-landing reads) each get a seed
> implementation, a DB implementation and a `parity-check` case; no page
> reads `lib/db/queries.ts`. When S4 ships `/trabajo-en/[ciudad]`, change
> the `ciudad` branch of `listingIndexRule()` and its expectation in
> `scripts/verify-seo.ts` in the same PR (the failure message says so), and
> switch the city chips in `/empleos`'s `TaxonomyLinks` from `?ciudad=` to
> the new route. The `capiatá` → `capiata` rename ships with its 301s in the
> same PR. Use `getAllPublishedJobSummaries()` rather than walking pages
> again. C1 is a Drizzle migration that extends the blog-category enum
> without renaming any value and makes `lib/blog-categories.ts` the single
> source.
>
> When all eleven are merged, append a `§12.2 State after Sonnet A+B` to
> PLAN-GROWTH.md in a final docs-only PR: helper names Sonnet C and D may
> rely on, and anything you deferred and why.

**Session 3 — Sonnet C, effort high (content + blog architecture):**

> You are Sonnet C (§6, C0, C2, C3). C1 is merged. First run **C0**: spawn
> one Sonnet subagent per article from the §4 C0 table (the ten sector
> guides plus two per other cluster, ~20), each writing one Markdown file
> with the `content/blog/README.md` frontmatter into `content/blog/drafts/`,
> `published: false`, `relatedCategorySlug` set (required for
> `guias-por-sector`), no unsourced numbers, `derechos-laborales` articles
> carrying the informational disclaimer and a `Revisión pendiente` line at
> the top. Review every draft yourself for voseo, Paraguay vocabulary, one
> landing link in the first 200 words, and the content rules; open one PR
> with the drafts. Then stop and tell the owner to publish at least five
> across two categories. Resume with **C2** and **C3** only after the owner
> confirms that.

**Session 4 — Sonnet D, effort high (redesign):**

> You are Sonnet D (§6, PRs 17–21): **D1, D2, D3, D4, D5** in that order.
> Read §12 too. A, B and C2 are merged. D1 is zero-visual-diff except the gold decision
> (D3 in §7); post before/after screenshots at 360 px and 1280 px for every
> D PR. The sticky mobile apply bar uses `WhatsAppCta` and the shared
> `whatsapp_click` event with `audience: 'seeker'`. D5 adds an `empresa`
> filter to `getJobs` as a seam change with parity, not a direct query.

---

## 11. Getting job supply — the playbook behind Batch P

The promotion is the offer; this is how it gets used. Nothing here is a PR
except where marked; it is what the owner and the team do with the tools
the site already has.

1. **Run the promotion as an outbound campaign, not a banner.** The 100
   free Destacados are a reason to message employers, not something to wait
   for. Target list, in order of yield: companies currently posting
   vacancies in Paraguayan Facebook groups and on Instagram (they have a
   live need this week), consultoras de RRHH and agencies (volume per
   contact), franchise/retail chains with constant hiring (gastronomía,
   atención al cliente, ventas), and the employers who already applied
   through `/publicar` and never converted. One WhatsApp script:
   `Hola {nombre}, soy {yo} de trabajo.com.py. Vimos que están buscando
   {puesto}. Estamos lanzando y los primeros 100 avisos salen destacados 90
   días, gratis — lo cargamos nosotros, solo necesitamos el texto y un
   WhatsApp de contacto. ¿Les interesa?` Track in the CRM with a `promo`
   tag; the site's `/admin` counter is the source of truth for the quota.
2. **Open the employer dashboard and self-serve signup now** (`EMPLOYER_DASHBOARD_ENABLED`,
   `EMPLOYER_SIGNUP_ENABLED`, both built and dark). Every employer the team
   loads a job for gets an invitation link (`employer_invitations`, admin-
   issued) in the same WhatsApp thread so they can post the next one
   themselves. Moderation is unchanged: everything still lands `pending`.
3. **Team-loaded listings with authorization, never scraping.** `PLAN.md`
   §1 rules out aggregation and this plan keeps that. The team may load a
   listing the employer sent or agreed to in writing (a WhatsApp "sí, dale"
   is written), attach the employer's WhatsApp as the apply number, and
   apply the promo at approval. Listings the team writes from a public post
   without the employer's answer are not loaded.
4. **Plan Empresa free for agencies during the promo.** A consultora that
   brings ten listings is worth ten outreach conversations; offer the
   monthly package free for the first three months via the same
   `promo_launch` grants per listing (no new mechanism), and record the
   agreement in the company's `activity_log` note.
5. **Close the loop on traffic so the WhatsApp promise stays honest.**
   Every approved listing is shared by the team into the relevant Facebook
   groups and WhatsApp communities with the job page's own share links
   (`ShareLinks`, U1). This is what produces the applicants the site does
   not yet generate organically; it is also what makes the employer come
   back. After S3, listings also surface in Google's job carousel, which is
   the organic version of the same loop.
6. **Measure supply weekly**: published listings, promo grants used,
   employers with a dashboard login, listings per employer, and the
   `whatsapp_click` (`audience: seeker`) count per listing — the number the
   team quotes back to the employer when the 90 days end and the renewal
   conversation starts (`/admin/empleos?featured=vencido`).
7. **What not to do**: no fake listings, no "100 empresas ya confían"
   copy, no applicant counts on public pages (`AGENTS.md`), no bulk import
   from other boards. The promotion's copy says what it is — a launch offer
   with a counter — and nothing more.

---

## 12. State after the Opus session (2026-09-08, PRs #85–#87 on `main`)

Verified against `main` at `9e6213d`. Later sessions rely on this and do
not rebuild it.

### 12.1 What exists

| Piece | Where | Notes |
|---|---|---|
| `launchPromoEnabled()`, `getLaunchPromoStatus()` | `lib/promo.ts` (server-only, async) | Returns `{ enabled, quota, granted, remaining }`; `remaining` clamped at 0, so surfaces gate on `enabled && remaining > 0` alone. Seed mode: `granted: 0`. |
| `LAUNCH_PROMO` (`{ quota: 100, days: 90 }`), `LAUNCH_PROMO_CHANNEL`, `FEATURE_GRANT_CHANNEL_LABELS` | `lib/featured.ts` (not server-only) | Client components may render the quota and the channel label from here. |
| `getJobFeatureState(id)` → `{ featuredUntil, active, channel }` | `lib/db/admin.ts` | `channel` is the last grant's channel from `activity_log`; the employer `PlanCard` promo line (P2) reads it through `lib/db/employer.ts`. |
| `invalidateLaunchPromo()` | `lib/cache.ts` | Already called by the grant path. |
| The grant | `applyFeatureGrant()` in `lib/db/admin.ts`, inside the admin PATCH transition to `published` | `'promo_launch'` may appear only in `lib/featured.ts` and `lib/db/admin.ts`; `moderation:verify` fails the build otherwise. No second grant path, ever. |
| `Job.expiresAt`, `Job.companyWebsite` | `lib/types.ts`, both readers, `parity-check` | `expiresAt` is the only source of `validThrough`; `seo:verify` fails if `featuredUntil` reappears in the JobPosting block. |
| `getClosedJob(slug)`, `ClosedJob` | `lib/data.ts` | The tombstone read. Do not add callers: `moderation:verify` asserts exactly two references to `closedPredicate()`. |
| `getAllPublishedJobSummaries()` | `lib/data.ts` | The whole catalogue in one page-walk; used by the sitemap and `/empleos/[slug]`'s `generateStaticParams`. |
| `siteUrl()`, `canonicalFor(path)`, `listingIndexRule(params)` | `lib/seo.ts` | All twelve public pages declare `alternates.canonical`. The `ciudad` branch canonicalises to `/empleos` until S4 ships `/trabajo-en/[ciudad]`; `scripts/verify-seo.ts` pins that and names the hand-off. |
| `TaxonomyLinks` | `app/empleos/page.tsx` | Category chips → `/trabajo/*`; city chips → `/empleos?ciudad=` until S4. |
| `JobFilters['orden']` | `lib/types.ts` | `'recientes' \| 'salario' \| 'destacados'`; `relevancia` is gone and `seo:verify` keeps it gone. |
| CI | `.github/workflows/ci.yml` | One new step, `seo:verify`; `moderation:verify` grew the promo and tombstone assertions in place. |

### 12.2 Gaps the next session closes

- `LAUNCH_PROMO_ENABLED` is read by `lib/promo.ts` but absent from
  `.env.example` and DEPLOY.md's env table — W1 adds it alongside the
  `NEXT_PUBLIC_*` entries it already owes.
- The promotion is dark in production until the owner sets
  `LAUNCH_PROMO_ENABLED=true` in hPanel and redeploys (§8).
