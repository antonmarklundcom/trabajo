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
