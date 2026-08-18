# MIGRATION.md — WordPress/JetEngine → first-party MySQL

> Runbook for the production cutover — steps 10–11 of `PLAN.md` (this doc
> predates the 2026-08-05 rewrite of `PLAN.md` into twelve numbered steps and
> originally said "Phase F"). Design lives in `ARCHITECTURE.md`;
> Hostinger/MySQL specifics in `DEPLOY.md`.
>
> **Status note (2026-08-18):** this doc is written as pre-cutover
> instructions. Whether the cutover (steps 5–7 below) has actually been run
> against production cannot be verified from the repo — that state lives in
> hPanel and the production database, not in code. Treat the runbook as
> current until the owner confirms otherwise.

## What is actually being migrated

**No data.** Production has always served `lib/seed/jobs.json`
(`USE_WP_BACKEND=false`), and the listings inside the WP panel are
placeholders. This is a code-path swap plus a content-entry exercise, not a
data migration. Nobody needs to export anything from WordPress.

That is also why this is worth doing now rather than after launch.

## Order of operations

Nothing below touches production until step 5.

1. **Provision** the MySQL database on Hostinger (same account as the app).
   Record the credentials before changing anything — see the stale-password
   trap in `DEPLOY.md`.
2. **Migrate + import from a local machine**, never over Hostinger SSH:
   ```
   npx drizzle-kit push          # or: generate + migrate
   npx tsx scripts/seed-import.ts
   ```
   `drizzle-kit` auto-loads `.env`; **`tsx` does not**. If the import throws
   `ECONNREFUSED` immediately after a successful migration, `DATABASE_URL` is
   undefined in the script's environment and mysql2 has fallen back to
   `localhost`. Export it into the shell session first.
3. **Verify locally** with `DATA_SOURCE=db`: run the Phase B parity check, then
   click through `/empleos` with filters, a job detail page, a
   `/trabajo/[categoria]/[ciudad]` landing, and `/sitemap.xml`. Output must
   match the seed path exactly.
4. **Enter real listings** via `/admin` (owner's team). Until there is real
   inventory, cutting over just swaps 28 fake jobs for 28 fake jobs — the
   content work is the gate here, not the code.
5. **Cut over**: set `DATA_SOURCE=db` and `DATABASE_URL` in hPanel →
   **redeploy** (env var changes do not take effect on a restart alone).
6. **Verify production** before touching anything else:
   - [ ] `/empleos` lists real jobs, pagination and every filter work
   - [ ] A job detail page renders, including its JSON-LD JobPosting
   - [ ] Category and city landings show correct counts (published jobs only)
   - [ ] `/sitemap.xml` contains the real slugs
   - [ ] An application submitted on the live site still reaches
         WhatsApp/GHL/Sheets
   - [ ] **No draft, pending, rejected, archived or expired job is publicly
         reachable** — check by URL directly, not just by absence from lists
7. **Roll back** if anything above fails: set `DATA_SOURCE=seed` in hPanel and
   redeploy. The seed path stays intact and working through the entire
   migration; that is the safety net, so do not delete it before step 8.

## Cleanup (only after production has been stable on `db`)

- Delete `lib/wp.ts`.
- Remove `WP_API_URL` and `USE_WP_BACKEND` from `.env.example`, hPanel, and the
  fallback branch in `lib/data.ts`.
- Remove the WordPress sections from `README.md`.
- Keep `lib/seed/*.json` in the repo as import fixtures, but remove `seed` from
  the read path once `db` has run clean for a week.
- Decommission `panel.trabajo.com.py` and cancel anything paid attached to it.

## Slug safety

Public URLs are built from `categories.slug`, `cities.slug` and `jobs.slug`.
The importer carries the existing seed slugs across verbatim, so no URL
changes and no redirects are needed. **After cutover, renaming any slug is an
SEO event** — it needs a 301, not just an edit. Worth stating plainly to
whoever gets admin access.

## Known trap

The single highest-risk bug in this migration is a public query that forgets
the visibility predicate and leaks unapproved or expired jobs. It is defined
once in `lib/db/queries.ts` (`ARCHITECTURE.md` §3) and every public read must
go through it. Step 6's last checkbox exists specifically to catch this.
