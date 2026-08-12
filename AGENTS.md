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
| `PLAN-IMAGES.md` | The shared public image pipeline: backend decision, validation rules, key scheme, what PR 19–21 inherit |
| `ARCHITECTURE.md` | Target backend design: the data seam, DB schema, auth, job lifecycle, caching |
| `MIGRATION.md` | WordPress → MySQL cutover runbook and rollback |
| `DEPLOY.md` | Hostinger + MySQL operations and their known traps |
| `README.md` | Current public site: routes, lead routing, env vars |

Non-negotiables:

- **`lib/data.ts` is the only data entry point for the public job catalog.** No
  page, component or API route may read `lib/seed/*.json` or the database
  directly for jobs, categories or cities — that seam is what makes
  `DATA_SOURCE=seed|db` switchable (`ARCHITECTURE.md` §3). Per-account data —
  candidate, employer, admin — has no seed representation and nothing to switch,
  so it goes straight to its scoped module (`lib/db/candidate-*.ts`,
  `lib/db/employer.ts`, `lib/db/candidates-admin.ts`) from a page that has
  already established the session. That is the rule, not an exception to it.
- **No foreign key constraints in `lib/db/schema.ts`, ever.** Plain int columns
  plus indexes; ownership is enforced in the query layer and cross-table cleanup
  is done in code, because the ARCO purge deliberately keeps some orphaned
  references and half-constrained referential integrity is worse than none. A
  new table that points at another one must be registered in
  `scripts/verify-cascades.ts` (`npm run cascade:verify`), which proves every
  hard delete of a parent row purges its dependents first.
- **Public reads go through the single visibility predicate** in
  `lib/db/queries.ts`. Forgetting it leaks unapproved jobs.
- **Authorization is checked server-side in every mutating handler.** Hiding a
  button is UX, not security.
- **UI copy is Spanish (Paraguay)** — including the admin panel. Docs and code
  comments are English.
- **Slugs are live SEO URLs.** Renaming one needs a 301, not just an edit. Blog
  slugs are the one case where the app issues it itself: renaming a published
  article mints a `blog_post_redirects` row inside the same write. Job and
  company slugs have no such table, so there the editor is warned and the
  redirect is still a manual step.
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
- **Public images go through `lib/image-storage.ts`, and what we store is never
  what was uploaded.** Every image is validated by magic bytes (JPG/PNG/WebP —
  never SVG), re-encoded to WebP with the original bytes discarded, and
  addressed by a minted `img/{logos|blog|jobs}/{uuid}.webp` key that is never
  derived from user input. The database stores the **key**, never the URL, which
  is what keeps `IMAGE_STORAGE_DRIVER` switchable (`PLAN-IMAGES.md` §2.1). No
  page, component or route touches `IMAGE_STORAGE_DIR` or the bucket directly.
  This rule is about **uploads** — bytes an outside party hands us at runtime.
  Images committed to the repo and served from `public/` (the category icons,
  blog cover images) are not uploads and do not go through it, for the reasons
  in `PLAN-IMAGES.md` §7; their size and format rules are asserted in CI
  instead. Nothing is ever written into `public/` at runtime.
- **The image store is public by construction and holds nothing private.**
  `/img/[...key]` has no session check because an image on an approved posting
  is public content. It never shares a directory or bucket with CVs, and no
  private file may be put in it "since both are just files".
- **Blog content is read through `lib/blog.ts` and nowhere else, and every
  public read there goes through `publishedPredicate()` in `lib/db/blog.ts`.**
  Same discipline `lib/data.ts` has over the job catalog, for the same reason:
  the draft-vs-published rule and the Markdown escaping are properties of the
  read, so there is one place where both are true. A page that imports
  `lib/db/blog.ts` directly is one forgotten WHERE clause from publishing a
  draft. `scripts/verify-blog.ts` asserts both halves.
- **Article bodies are stored as Markdown and rendered by `renderMarkdown()`,
  which escapes raw HTML.** Never store rendered HTML, and do not add a
  WYSIWYG editor that would: the body now arrives over HTTP from an admin
  session, so the escape is the boundary between "an editor writes an article"
  and "an editor writes JavaScript that runs in every visitor's browser".
- **Consent is append-only.** Withdrawal is a new row, never an UPDATE on
  `consents`.
- **Deletion of candidate data is a hard DELETE.** `candidateCvs.deletedAt` is
  purge bookkeeping written after the bytes are already gone, and
  `candidates.isActive` is an account flag used in the auth lookup — neither is
  a soft delete, and no new soft-delete flag may be added.
- **No search, ranking, scoring, matching or bulk export of candidates.**
  Phase 4, gated on legal review (`PLAN-PHASE2.md` §6 "Phase 4 — NOT NOW").
