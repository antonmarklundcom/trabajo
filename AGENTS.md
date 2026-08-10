<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on this repo

Read before writing code:

| Doc | What it holds |
|---|---|
| `PLAN.md` | The WordPress → MySQL rebuild: 12 steps, gates, model tiering, open questions (all merged) |
| `PLAN-PHASE2.md` | Next body of work: employer dashboard + job seeker profiles — schema, consent/ARCO model, 14 PRs with model per PR |
| `ARCHITECTURE.md` | Target backend design: the data seam, DB schema, auth, job lifecycle, caching |
| `MIGRATION.md` | WordPress → MySQL cutover runbook and rollback |
| `DEPLOY.md` | Hostinger + MySQL operations and their known traps |
| `README.md` | Current public site: routes, lead routing, env vars |

Non-negotiables:

- **`lib/data.ts` is the only data entry point.** No page, component or API
  route may read `lib/seed/*.json` or the database directly.
- **Public reads go through the single visibility predicate** in
  `lib/db/queries.ts`. Forgetting it leaks unapproved jobs.
- **Authorization is checked server-side in every mutating handler.** Hiding a
  button is UX, not security.
- **UI copy is Spanish (Paraguay)** — including the admin panel. Docs and code
  comments are English.
- **Slugs are live SEO URLs.** Renaming one needs a 301, not just an edit.
- **Employer reads go through `lib/db/employer.ts`, and every function there
  takes `companyId` as its first argument.** No admin bypass branch in that
  file, ever.
- **Row-level admin reads of candidate data go through
  `lib/db/candidates-admin.ts`, which logs to `data_access_logs` before it
  returns.** No candidate data read from anywhere else, with three deliberate
  exceptions and no others: `lib/db/stats.ts` may read candidate tables through
  `count()` aggregates only (no data subject, so nothing to log);
  `lib/db/employer.ts` reads the candidate profile and CV attached to that
  company's own applications; and `lib/db/retention.ts` +
  `lib/db/candidate-arco.ts` operate on candidate rows as part of the purge and
  ARCO paths.
- **The access log records the portal team only.** Employer access to a
  candidate's data on their own listing is deliberately not logged, and
  `/privacidad` §6 is worded to match. Do not "complete" the log without
  changing that copy first.
- **No public URL for a CV.** All three download paths (`/api/admin/cv/[id]`,
  `/api/empresa/cv/[applicationId]`, `/api/postulante/cv/[id]`) are authorized
  route handlers, and `CV_STORAGE_DIR` lives outside the build root.
- **Consent is append-only.** Withdrawal is a new row, never an UPDATE on
  `consents`.
- **Deletion of candidate data is a hard DELETE.** `candidateCvs.deletedAt` is
  purge bookkeeping written after the bytes are already gone, and
  `candidates.isActive` is an account flag used in the auth lookup — neither is
  a soft delete, and no new soft-delete flag may be added.
- **No search, ranking, scoring, matching or bulk export of candidates.**
  Phase 4, gated on legal review (`PLAN-PHASE2.md` §6 "Phase 4 — NOT NOW").
