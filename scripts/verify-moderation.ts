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
// 5. The launch promotion is a consequence of approval, never a route to it
//    (PLAN-GROWTH.md §4 P1).
//
//    The promotion grants a free 90-day Destacado to the first 100 approved
//    listings. The risk it introduces is not a wrong window — featured:verify
//    covers the arithmetic — but a second place that decides a job is
//    published. So: `promo_launch` may be written in exactly ONE place, that
//    place is the admin status handler's transaction, and the grant it makes
//    is gated on a transition INTO `published` from something that was not.
//
//    A promo grant on create, on the employer path, or on /api/publicar would
//    be a listing promoting itself with a coupon, and would look on the public
//    site exactly like one the team approved.
// ---------------------------------------------------------------------------

const PROMO_CHANNEL = "'promo_launch'";

{
  // Every source file, minus the two that are ALLOWED to name the channel:
  // lib/featured.ts declares it, lib/db/admin.ts writes it.
  const roots = ['app', 'components', 'lib', 'scripts'];
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (file === 'lib/db/admin.ts' || file === 'lib/featured.ts') continue;
      if (file === 'scripts/verify-moderation.ts') continue;
      if (code(read(file)).includes(PROMO_CHANNEL)) offenders.push(file);
    }
  }
  check(
    'the promo channel is named only where it is declared and written',
    offenders.length === 0,
    `Found in: ${offenders.join(', ')}. lib/featured.ts declares LAUNCH_PROMO_CHANNEL and ` +
      'lib/db/admin.ts writes it. Anywhere else is a second grant path.',
  );
}

const admin = read('lib/db/admin.ts');
const adminCode = code(admin);
const promoBody = functionBody(admin, 'updateJobWithLaunchPromo');

check(
  'updateJobWithLaunchPromo() exists and is inspectable',
  promoBody.length > 0,
  'Could not find updateJobWithLaunchPromo() in lib/db/admin.ts. If the promo grant moved, ' +
    'move this check with it.',
);

check(
  'lib/db/admin.ts names the promo channel only where it counts and where it grants',
  (adminCode.match(/LAUNCH_PROMO_CHANNEL/g) ?? []).length === 4,
  'Expected exactly four: the import, the two counter predicates (total granted, and this ' +
    "job's own grant), and the grant itself. A fifth is a fifth thing to prove.",
);

check(
  'the promo grant goes through applyFeatureGrant()',
  /applyFeatureGrant\(/.test(code(promoBody)),
  'PLAN-PAGOPAR.md §4 point 5: not a second UPDATE jobs somewhere. The promotion is a ' +
    'channel on the one grant, so featured:verify still covers its arithmetic.',
);

check(
  'the promo grant runs inside a transaction with the status write',
  /db\.transaction\(/.test(code(promoBody)) &&
    code(promoBody).indexOf('updateJob(') < code(promoBody).indexOf('applyFeatureGrant('),
  'The quota check and the status write must not be able to half-happen: a counter that ' +
    'disagrees with the grants behind it is a promotion nobody can reconcile.',
);

check(
  'the promo grant requires a transition INTO published from something else',
  code(promoBody).includes("input.status === 'published'") &&
    code(promoBody).includes("before.status !== 'published'") &&
    code(promoBody).includes('if (!isApproval) return'),
  'Approval is the only moment the promotion applies. Without both halves, re-saving an ' +
    'already-published listing would grant a second free window, and — worse in kind — a ' +
    'grant could be reached on a save that never published anything.',
);

check(
  'the promo grant is refused once the quota is spent or the job already had one',
  code(promoBody).includes('jobHasLaunchPromoGrant(') &&
    code(promoBody).includes('countLaunchPromoGrants(') &&
    code(promoBody).includes('LAUNCH_PROMO.quota'),
  'One grant per aviso and 100 in total is what /terminos promises. Both checks belong ' +
    'inside the transaction, where the status write is.',
);

check(
  'the promotion never sets a job status itself',
  (promoBody.match(/status:\s*'(draft|pending|published|rejected|archived)'/g) ?? []).length === 0,
  'The status comes from JobInput, written by updateJob(). A status literal here would be ' +
    'the promotion publishing something.',
);

for (const file of [...walk('app/api/empresa'), ...walk('app/api/publicar')]) {
  const source = code(read(file));
  check(
    `${file} cannot request the launch promotion`,
    !/applyLaunchPromo/.test(source) && !/promo_launch/.test(source),
    'The promotion is applied by a human at approval. A public or employer route that could ' +
      'ask for it would be a listing comping itself.',
  );
}

// ---------------------------------------------------------------------------
// 6. And the other end of it: the public site still shows `published` only, so
//    "lands pending" and "is not public" are the same statement.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. The tombstone reads OUTSIDE the visibility predicate, and may only ever
//    find a listing that was once public (PLAN-GROWTH.md §4 S3, §7 D6).
//
//    getClosedJob() is the single deliberate exception to "public reads go
//    through visiblePredicate()". What makes it safe is not the exception
//    being small but the two statuses it names: `published` (whose expiry has
//    passed) and `archived`. A tombstone for a draft, a pending submission or
//    a rejected one would confirm to anyone guessing slugs that the listing
//    exists, and name the company that submitted it — the moderation gate
//    leaking through the 404 handler.
// ---------------------------------------------------------------------------

const closedBody = functionBody(queries, 'closedPredicate');

check(
  'closedPredicate() exists and is inspectable',
  closedBody.length > 0,
  'Could not find closedPredicate() in lib/db/queries.ts. If the tombstone read moved, ' +
    'move this check with it.',
);

{
  const statuses = (code(closedBody).match(/jobs\.status,\s*'(\w+)'/g) ?? []).map((m) =>
    m.slice(m.indexOf("'") + 1, m.lastIndexOf("'")),
  );
  check(
    "closedPredicate() names only 'published' and 'archived'",
    statuses.length === 2 && statuses.includes('published') && statuses.includes('archived'),
    `Found: ${statuses.join(', ') || 'no status literal at all'}. A third status here is a ` +
      'listing that was never public getting a page.',
  );
}

check(
  "closedPredicate() requires an elapsed expiry alongside 'published'",
  code(closedBody).includes('IS NOT NULL') && code(closedBody).includes('<= NOW()'),
  'Without both halves, every published listing matches and the tombstone replaces the ' +
    'live page.',
);

check(
  'getClosedJob() is the only query built on closedPredicate()',
  (code(queries).match(/closedPredicate\(\)/g) ?? []).length === 2,
  'Expected two: the declaration and queryClosedJob()\'s WHERE. A third caller is a ' +
    'second read outside the visibility predicate.',
);

check(
  'the tombstone query selects no description, whatsapp or salary',
  !/jobs\.description|jobs\.whatsapp|jobs\.salary/.test(functionBody(queries, 'queryClosedJob')),
  'A closed listing may show its title and company. Handing back the description or the ' +
    "employer's number would make the tombstone a working posting.",
);

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
