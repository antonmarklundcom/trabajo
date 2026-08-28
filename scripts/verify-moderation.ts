// Asserts the one rule self-serve employer signup is not allowed to relax:
//
//   npm run moderation:verify
//
// An employer-created job posting reaches the public site ONLY by passing
// through /admin approval. Self-serve signup (PLAN-PHASE2.md §8 Q2) widened
// who can reach the employer panel; it did not widen what the panel can do,
// and this script is the mechanical statement of that.
//
// Why a script rather than a review note. The failure is silent in exactly the
// way scripts/verify-scoping.ts and scripts/verify-candidate-access.ts exist
// for: a posting that skipped moderation renders identically to one that
// passed it. Nothing in `next build`, in lint, or in a click-through can tell
// them apart — the only visible difference is a listing on the public site
// that nobody approved, discovered by whoever it embarrasses.
//
// scripts/verify-scoping.ts already asserts the runtime half of this (it
// creates a job through createEmployerJob() and reads its status back), but it
// needs a live database and therefore does not run in CI. This one is
// source-reading — no database, no env, no network — so it runs on every PR.
//
// It is deliberately literal about the expressions it accepts. A check that
// merely grepped for the word "pending" would stay green while the surrounding
// condition inverted.
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

/**
 * Source with comments removed.
 *
 * Load-bearing rather than tidy: several assertions below are "this file never
 * mentions X", and every one of those files mentions X in a comment explaining
 * why it does not. Matching prose would make the checks fail on the very
 * documentation that states the property.
 */
function code(source: string): string {
  // Line comments FIRST. These files discuss paths like `lib/db/*` in prose,
  // and a leading block-comment pass would take that `/*` as an opening
  // delimiter and swallow everything up to the next `*/` — silently deleting
  // the code the assertions are about, which reads as "the property holds".
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The body of `export ... function <name>`, up to its closing brace column 0. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.indexOf('\n}');
  return end === -1 ? rest : rest.slice(0, end);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

const employer = read('lib/db/employer.ts');
const signup = code(read('lib/db/employer-signup.ts'));
const queries = read('lib/db/queries.ts');

// ---------------------------------------------------------------------------
// 1. A job an employer creates is born `pending`, whatever the caller asked
//    for. The status is not part of EmployerJobInput and never can be.
// ---------------------------------------------------------------------------

const createBody = functionBody(employer, 'createEmployerJob');

check(
  'createEmployerJob() exists and is inspectable',
  createBody.length > 0,
  'Could not find createEmployerJob() in lib/db/employer.ts. If it moved, move this check with it.',
);

check(
  "createEmployerJob() hardcodes status: 'pending'",
  /status:\s*'pending'/.test(createBody),
  'An employer submission is a request to publish, not a publication.',
);

check(
  'createEmployerJob() writes no other status',
  (createBody.match(/status:\s*'(\w+)'/g) ?? []).every((m) => m.includes("'pending'")),
  `Found: ${(createBody.match(/status:\s*'(\w+)'/g) ?? []).join(', ')}`,
);

const createFeatured = createBody.match(/featuredUntil:\s*(\w+)/g) ?? [];

check(
  'createEmployerJob() sets featuredUntil to null and nothing else',
  createFeatured.length === 1 && createFeatured[0] === 'featuredUntil: null',
  `Found: ${createFeatured.join(', ') || 'no featuredUntil at all'}. Featured placement is ` +
    'fulfilment of a sale, not something a submission can request.',
);

check(
  'EmployerJobInput carries no status, featuredUntil or companyId',
  !/^\s*(status|featuredUntil|companyId)\??:/m.test(
    employer.slice(
      employer.indexOf('export type EmployerJobInput'),
      employer.indexOf('async function jobSlugExists'),
    ),
  ),
  'A field on this type is a field a route handler can forward from the request body.',
);

// ---------------------------------------------------------------------------
// 2. The ONE place lib/db/employer.ts writes 'published' is the re-approval
//    guard in updateEmployerJob(), and it can only ever KEEP a job published —
//    never promote one that was not.
// ---------------------------------------------------------------------------

const updateBody = functionBody(employer, 'updateEmployerJob');

check(
  "updateEmployerJob() still guards status on `existing.status !== 'published'`",
  updateBody.includes(
    "const needsReapproval = existing.status !== 'published' || isMaterialChange(existing, input);",
  ),
  'This exact expression is what makes a promotion impossible: anything not already ' +
    'published needs re-approval, so the false branch is only reachable for a job admin ' +
    'already approved. If it was refactored, re-derive that property and update this check.',
);

check(
  "updateEmployerJob() writes status only as `needsReapproval ? 'pending' : 'published'`",
  updateBody.includes("status: needsReapproval ? 'pending' : 'published'") &&
    (updateBody.match(/status:\s*/g) ?? []).length === 1,
  'A second status write in this function is a second thing to prove.',
);

check(
  "lib/db/employer.ts contains no unconditional status: 'published'",
  !/status:\s*'published'/.test(employer),
  'The only write of that value must stay behind the needsReapproval ternary.',
);

check(
  'updateEmployerJob() never writes featuredUntil at all',
  !/featuredUntil/.test(updateBody),
  'Setting featured_until is the admin path (and, from PR 2, a verified payment webhook). ' +
    'An employer-scoped write of it would be a listing promoting itself. The read-only ' +
    'uses elsewhere in this file — the plan summary and the job list projection — are ' +
    'SELECTs, which is why this is scoped to the two write functions.',
);

// ---------------------------------------------------------------------------
// 3. Self-serve signup touches accounts, never postings — and never attaches
//    to a company that already exists (PLAN-PHASE2.md §8 Q2's actual risk).
// ---------------------------------------------------------------------------

check(
  'employer-signup.ts never imports or writes the jobs table',
  !/\bjobs\b/.test(signup),
  'Signup provisions an account. A job write here would be a posting created outside ' +
    'createEmployerJob(), which is the only place the pending default lives.',
);

check(
  "employer-signup.ts creates the account with role: 'employer' and no other role",
  (signup.match(/role:\s*'(\w+)'/g) ?? []).join() === "role: 'employer'",
  `Found: ${(signup.match(/role:\s*'(\w+)'/g) ?? []).join(', ') || 'no role literal at all'}. ` +
    'users.role stays admin | editor | employer, and a self-serve account is an ordinary ' +
    'employer — identical to an invited one once created.',
);

check(
  'employer-signup.ts mints a NEW company rather than joining one',
  signup.includes("createdVia: 'self_serve'") &&
    signup.includes('.insert(companies)') &&
    !/eq\(companies\.id/.test(signup),
  'A lookup of an existing company by id here would be exactly the "anyone can claim a ' +
    'company and read its applications" risk Q2 deferred self-serve over. Joining an ' +
    'existing company is employer-invitations.ts only, behind an admin-issued token.',
);

check(
  'employer-signup.ts reserves the identity before creating the company',
  signup.indexOf('.insert(users)') < signup.indexOf('.insert(companies)'),
  'users.email is UNIQUE and is what rejects a racing duplicate signup. Creating the ' +
    'company first would leave an ownerless company behind on that rejection.',
);

// ---------------------------------------------------------------------------
// 4. No /api/empresa route handler can name a job status or featured window.
// ---------------------------------------------------------------------------

for (const file of walk('app/api/empresa')) {
  const source = code(read(file));
  check(
    `${file} does not write a job status or featured window`,
    !/status:\s*'(draft|pending|published|rejected|archived)'/.test(source) &&
      !/featuredUntil/.test(source),
    'Job lifecycle writes belong in lib/db/employer.ts (pending) and the admin path.',
  );
}

// ---------------------------------------------------------------------------
// 5. And the other end of it: the public site still shows `published` only, so
//    "lands pending" and "is not public" are the same statement.
// ---------------------------------------------------------------------------

check(
  "visiblePredicate() still requires status = 'published'",
  functionBody(queries, 'visiblePredicate').includes("eq(jobs.status, 'published')"),
  'AGENTS.md: public reads go through the single visibility predicate. Everything above ' +
    'is only worth asserting because this line is what makes `pending` mean invisible.',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll moderation-gate assertions passed.');
process.exit(0);
