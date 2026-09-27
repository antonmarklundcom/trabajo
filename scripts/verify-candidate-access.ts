// Asserts the §2.4 construction in lib/db/candidates-admin.ts, statically.
//
// PLAN-PHASE2.md §2.3 says the employer-scoping rule is worth having because it
// is "mechanically checkable rather than a judgement call", and scripts/
// verify-scoping.ts checks it. §2.4 makes a stronger promise about candidate
// data — that there is NO code path returning it without a data_access_logs row
// — and the privacy policy repeats that promise to the public. This script is
// the mechanical check for it.
//
// It reads the source rather than executing it, because the property is about
// what the file may contain, and because the runtime alternative needs a
// database and would only cover the paths someone remembered to call. A reader
// of a diff gets the same answer this gives: every exported function checks the
// role, every function that returns candidate data logs first, and the two
// features that would turn this module into a talent database are absent.
//
// It is deliberately conservative: it fails on anything it does not recognise
// rather than passing it. A new export here should have to be added to a list
// in this file, so that adding one is a decision instead of a diff.
//
// Second half (added with the /admin/postulaciones fix): the same promise
// covers APPLICATIONS, whose name / phone / email / message columns are an
// applicant's personal data whether or not they have an account. Until that
// fix, lib/db/admin.ts read those columns for the staff table with no log row.
// The repo-wide scan at the bottom asserts that no module outside a short
// allowlist references those columns at all, and that every export of
// candidates-admin.ts that does logs before returning.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULE_PATH = join(process.cwd(), 'lib/db/candidates-admin.ts');
const source = readFileSync(MODULE_PATH, 'utf8');

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

// ---------------------------------------------------------------------------
// The known exports. Adding a function to this module means adding it here,
// with a decision about whether it discloses candidate data.
// ---------------------------------------------------------------------------

/** Exported functions that return personal data about a candidate. */
const DISCLOSING = new Set(['viewCandidateCvAsAdmin', 'viewCandidate']);

/**
 * Exported functions that return applicants' personal data to the portal team
 * from a surface that predates this module and was always open to `editor`
 * too. They get the same "log before every data return" check as DISCLOSING,
 * but a different role gate (requireApplicationStaff: admin | editor) and no
 * reason requirement — see the header of candidates-admin.ts for why both are
 * preserved status quo rather than a new grant.
 */
const STAFF_APPLICATION_READS: Record<string, string> = {
  listApplicationsForStaff: '/admin/postulaciones — logs view_application per data subject',
};

/**
 * Exported functions that may return without a log row, each with the reason it
 * is allowed to. Anything not in one of these two sets fails the run.
 */
const NON_DISCLOSING: Record<string, string> = {
  // Aggregates have no data subject; the lookup branch inside it DOES log, and
  // that is asserted separately below.
  listCandidates: 'aggregate by default; logs when a lookup resolves',
  // Reads the log itself: ids, actions, staff names — no candidate data.
  listAccessLogs: 'reads data_access_logs, which holds no candidate data',
};

/**
 * Exported functions that need neither requireAdmin() nor a log row, because
 * they never touch the database or a candidate's data — pure computation only.
 * Checked below anyway: if one of these ever calls getDb()/logAccess(), that is
 * exactly the kind of quiet scope-creep this whole script exists to catch, so
 * it fails rather than silently starting to count as compliant.
 */
const HELPERS: Record<string, string> = {
  resolveAccessReason: 'pure string formatting for the UI reason gate — its own doc comment says ' +
    'it is never the gate itself',
};

// ---------------------------------------------------------------------------
// Crude but sufficient body extraction: from one top-level export to the next.
// The module is one flat file of top-level declarations, which is exactly the
// shape this handles correctly.
//
// Three export shapes are recognised as functions — `export async function`,
// `export function`, and `export const name = (async )?(` — because all three
// exist somewhere in this codebase's lib/db modules. `export type`, `export
// const X = <literal>` and `export class` are exports too, but not functions,
// so they are deliberately not matched here; they still count as body-boundary
// markers via the `^export ` scan below, same as before.
// ---------------------------------------------------------------------------

type Fn = { name: string; body: string };

function exportedFunctions(src: string): Fn[] {
  const patterns = [
    /^export async function (\w+)\(/gm,
    /^export function (\w+)\(/gm,
    /^export const (\w+)\s*(?::[^=\n]+)?=\s*(?:async\s*)?\(/gm,
  ];
  const starts: { name: string; start: number }[] = [];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(src)) !== null) {
      starts.push({ name: match[1]!, start: match.index });
    }
  }
  starts.sort((a, b) => a.start - b.start);

  const out: Fn[] = [];
  for (const { name, start } of starts) {
    const nextExport = src.slice(start + 1).search(/^export /m);
    const end = nextExport === -1 ? src.length : start + 1 + nextExport;
    out.push({ name, body: src.slice(start, end) });
  }
  return out;
}

const functions = exportedFunctions(source);

console.log(`lib/db/candidates-admin.ts — ${functions.length} exported function(s)\n`);
check('the module exports at least the four PR 7 + PR 12 functions', functions.length >= 4);

for (const fn of functions) {
  const known =
    DISCLOSING.has(fn.name) ||
    fn.name in STAFF_APPLICATION_READS ||
    fn.name in NON_DISCLOSING ||
    fn.name in HELPERS;
  check(
    `${fn.name}: is a known export`,
    known,
    'New exports must be classified in scripts/verify-candidate-access.ts as disclosing, ' +
      'non-disclosing, or a helper.',
  );

  if (fn.name in HELPERS) {
    check(
      `${fn.name}: a helper, touches neither the database nor the access log`,
      !/\bgetDb\s*\(|\blogAccess(?:Many)?\s*\(/.test(fn.body),
      `Classified as a pure helper (${HELPERS[fn.name]}), but its body now calls getDb() or ` +
        'logAccess(). Reclassify it as disclosing or non-disclosing instead.',
    );
    continue;
  }

  if (fn.name in STAFF_APPLICATION_READS) {
    // The one admin|editor gate. Asserted positively here and negatively for
    // every other export below, so the wider gate cannot spread by copy-paste.
    check(
      `${fn.name}: calls requireApplicationStaff(actor)`,
      fn.body.includes('requireApplicationStaff(actor)'),
    );
  } else {
    // §2.4: role is checked as exactly `admin`, inside the function.
    check(`${fn.name}: calls requireAdmin(actor)`, fn.body.includes('requireAdmin(actor)'));
    check(
      `${fn.name}: does not use the admin|editor application gate`,
      !fn.body.includes('requireApplicationStaff('),
      'requireApplicationStaff() exists to preserve editor access to /admin/postulaciones only. ' +
        'Everything else in this module is admin-only (PLAN-PHASE2.md §2.4).',
    );
  }

  if (DISCLOSING.has(fn.name) || fn.name in STAFF_APPLICATION_READS) {
    if (DISCLOSING.has(fn.name)) {
      // §2.4: the reason is non-optional and validated before the read.
      check(`${fn.name}: validates the reason`, fn.body.includes('requireReason(reason)'));
    }
    const logCall = /await logAccess(?:Many)?\(/.exec(fn.body);
    check(`${fn.name}: writes a data_access_logs row`, logCall !== null);

    // Every return that hands back actual data — not the `return null;` early
    // exit for "nothing was found, nothing was disclosed" — must come AFTER
    // the log call. Checking only the last return would miss an earlier data
    // return slipped in above the log; this checks all of them.
    const logAt = logCall ? logCall.index : -1;
    const dataReturns = [...fn.body.matchAll(/\breturn\s+([^;]+);/g)]
      .filter((m) => m[1]!.trim() !== 'null')
      .map((m) => m.index!);
    check(
      `${fn.name}: has at least one data return to check`,
      dataReturns.length > 0,
      'Expected a `return <value>;` other than the null early-exit. If the shape changed, ' +
        're-derive this check.',
    );
    check(
      `${fn.name}: logs before every data return`,
      logAt !== -1 && dataReturns.every((idx) => logAt < idx),
      'A `return null;` early exit is fine unlogged (nothing was disclosed), but every other ' +
        'return must come after the logAccess() call.',
    );
  }
}

const staffListFn = functions.find((f) => f.name === 'listApplicationsForStaff');
check(
  "listApplicationsForStaff: logs as 'view_application'",
  Boolean(staffListFn && /logAccessMany\(\s*actor,\s*'view_application'/.test(staffListFn.body)),
  'The staff application table discloses applicants, and the action vocabulary for that is ' +
    "'view_application' (schema.ts dataAccessActionEnum).",
);
check(
  'listApplicationsForStaff: skips only redacted rows when building the log subjects',
  Boolean(
    staffListFn &&
      /for \(const row of rows\) \{\s*if \(row\.redactedAt\) continue;/.test(staffListFn.body),
  ),
  'A redacted row carries no personal data and is the only row that may go unlogged. If the ' +
    'subject-building loop changed shape, re-derive this check rather than deleting it.',
);

// listCandidates is the one hybrid: no log for the aggregate, a log for a
// resolved lookup. Assert the second half explicitly, since the loop above
// exempts it.
const listFn = functions.find((f) => f.name === 'listCandidates');
check(
  'listCandidates: logs when a lookup resolves',
  Boolean(listFn && /if \(match\)[\s\S]{0,200}logAccess\(/.test(listFn.body)),
  'A resolved lookup discloses that a specific person has an account and must be logged.',
);

// ---------------------------------------------------------------------------
// The two features that must never appear here (PLAN-PHASE2.md §5.2, Phase 4).
// ---------------------------------------------------------------------------

const code = source
  // Comments talk ABOUT these things on purpose; only real code counts.
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join('\n');

check(
  'no LIKE / free-text search over candidate data',
  !/\blike\s*\(|\bilike\s*\(|LIKE\s+'%/i.test(code),
  'Lookup is by exact email or exact id only (§5.2).',
);

check(
  "no export action written from this module",
  !/'export'/.test(code),
  "The data_access_logs action 'export' has no writer, because there is no bulk export (§5.2).",
);

check(
  'no exported function whose name suggests bulk access',
  !functions.some((f) => /export|bulk|todos|search|buscar/i.test(f.name)),
  'A bulk export is the single feature that would make this a talent database (§5.2).',
);

// ---------------------------------------------------------------------------
// Application personal data: who may READ applications.name / phone / email /
// message (AGENTS.md: "No candidate data read from anywhere else").
//
// The distinction this has to get right is read vs write. A read names the
// column object — `applications.name` in a select(), a where(), or a sql``
// template. A write names the column as an object KEY inside .values({...}) or
// .set({...}) — `name: input.name`, `name: null` — and never as
// `applications.name`. So "does the code reference `applications.<column>`" is
// exactly "does it read that column", and lib/db/admin.ts's createApplication()
// insert and deleteJob() redaction pass while a select of the same columns
// fails. The fixtures below prove the classifier draws that line before the
// scan relies on it.
//
// Also caught, because each one reads every column without naming any:
//   - `.select().from(applications)` (select-all)
//   - `getTableColumns(applications)`
//   - drizzle's relational `db.query.applications`
//   - importing `applications` under another name, which would blind the
//     column regex — refused outright rather than chased.
// ---------------------------------------------------------------------------

const PERSONAL_COLUMN_READ = /\bapplications\s*\.\s*(name|phone|email|message)\b/;
const SELECT_ALL_APPLICATIONS = /\.select\(\s*\)\s*\.from\(\s*applications\s*\)/;
const TABLE_COLUMNS = /getTableColumns\(\s*applications\s*\)/;
const RELATIONAL_QUERY = /\.query\s*\.\s*applications\b/;
const ALIASED_IMPORT = /\bapplications\s+as\s+\w+/;
const RAW_SQL_COLUMN = /`applications`\s*\.\s*`?(name|phone|email|message)\b/;

// Block comments are only recognised where they START a line. An unanchored
// `/\*...\*\/` match would begin at the `/*` inside a line comment such as
// "for /admin/* and /api/admin/*" and swallow real code up to the next JSDoc
// close — which is how the first draft of this scan missed an aliased import.
function stripComments(src: string): string {
  return src
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}

/** Which rules a piece of (comment-stripped) source trips. Empty = clean. */
function personalReads(src: string): string[] {
  const hits: string[] = [];
  if (PERSONAL_COLUMN_READ.test(src)) hits.push('references applications.<name|phone|email|message>');
  if (SELECT_ALL_APPLICATIONS.test(src)) hits.push('.select().from(applications) (select-all)');
  if (TABLE_COLUMNS.test(src)) hits.push('getTableColumns(applications)');
  if (RELATIONAL_QUERY.test(src)) hits.push('db.query.applications (relational read)');
  if (ALIASED_IMPORT.test(src)) hits.push('imports `applications` under an alias');
  if (RAW_SQL_COLUMN.test(src)) hits.push('raw SQL naming an application personal column');
  return hits;
}

// Classifier fixtures — the read/write line, drawn explicitly.
const FIXTURES: { name: string; src: string; read: boolean }[] = [
  {
    name: 'insert with personal values (createApplication shape)',
    src:
      'await db.insert(applications).values({ jobId: job.id, name: input.name, ' +
      'phone: input.phone, email: input.email, message: input.message });',
    read: false,
  },
  {
    name: 'redaction update (deleteJob / redactApplications shape)',
    src:
      'await db.update(applications).set({ name: null, phone: null, email: null, ' +
      'message: null, redactedAt: now }).where(eq(applications.jobId, id));',
    read: false,
  },
  {
    name: 'count-only aggregate (stats.ts shape)',
    src: 'db.select({ n: count() }).from(applications).where(isNull(applications.candidateId))',
    read: false,
  },
  {
    name: 'select of a personal column',
    src: 'db.select({ id: applications.id, name: applications.name }).from(applications)',
    read: true,
  },
  { name: 'where on a personal column', src: 'where(eq(applications.email, email))', read: true },
  { name: 'select-all', src: 'db.select().from(applications)', read: true },
  {
    name: 'raw SQL column',
    src: 'sql`SELECT `applications`.`phone` FROM applications`',
    read: true,
  },
  { name: 'aliased import', src: "import { applications as apps } from './schema';", read: true },
  {
    name: 'a read after a line comment containing a glob is not stripped as a comment',
    src:
      '// Admin-side reads for /admin/* and /api/admin/*.\n' +
      "import { applications as apps } from './schema';\n" +
      '/** A JSDoc block. */\n' +
      'export const x = 1;',
    read: true,
  },
  {
    name: 'a personal column named only inside a JSDoc block is not a read',
    src: '/**\n * Selects applications.name for the table.\n */\nexport const x = 1;',
    read: false,
  },
];
for (const fx of FIXTURES) {
  // Through stripComments(), exactly as the repo scan below reads each file.
  const flagged = personalReads(stripComments(fx.src)).length > 0;
  check(
    `classifier: ${fx.name} is ${fx.read ? 'a read' : 'not a read'}`,
    flagged === fx.read,
    'The read/write classifier for application personal columns drew the line in the wrong ' +
      'place; the repo scan below cannot be trusted until this passes.',
  );
}

/**
 * The only modules allowed to read application personal columns, each with the
 * AGENTS.md reason. lib/db/admin.ts is deliberately NOT here: it inserts and
 * redacts applications, and its one staff read moved to candidates-admin.ts.
 * lib/db/stats.ts is not here either — it is count()-only, so it has nothing
 * to allow, and if it ever names a personal column this scan fails it.
 */
const PERSONAL_READ_ALLOWLIST: Record<string, string> = {
  'lib/db/candidates-admin.ts': 'the logged staff path — its exports are checked above',
  'lib/db/employer.ts': "the company's own applications; deliberately unlogged (AGENTS.md)",
  'lib/db/retention.ts': 'the retention/redaction sweep',
  'lib/db/candidate-arco.ts': "the candidate's own ARCO export and purge",
};

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'lib', 'components'];

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
}

const scanned: string[] = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), scanned);
const scannedRel = scanned.map((f) => relative(ROOT, f).split('\\').join('/'));
check(
  'repo scan found source files to check, including lib/db/admin.ts',
  scannedRel.length > 50 && scannedRel.includes('lib/db/admin.ts'),
  'The scan walked too few files, or missed lib/db/admin.ts — a scan that sees nothing passes ' +
    'everything.',
);

let offenders = 0;
scannedRel.forEach((rel, i) => {
  if (rel in PERSONAL_READ_ALLOWLIST) return;
  const hits = personalReads(stripComments(readFileSync(scanned[i]!, 'utf8')));
  if (hits.length === 0) return;
  offenders += 1;
  check(
    `${rel}: reads no application personal columns`,
    false,
    `${hits.join('; ')}. Staff reads of applicant data go through lib/db/candidates-admin.ts ` +
      '(logged); only the modules in PERSONAL_READ_ALLOWLIST may read these columns.',
  );
});
if (offenders === 0) {
  check(
    `no module outside the allowlist reads application personal columns (${scannedRel.length} files)`,
    true,
  );
}

// Inside candidates-admin.ts itself: every reference to an application personal
// column must sit inside the body of an export that logs before returning. A
// module-level selection object or a private helper would put the read outside
// every body the per-export checks above look at.
{
  const src = stripComments(source);
  const loggedRanges = exportedFunctions(src)
    .filter((f) => DISCLOSING.has(f.name) || f.name in STAFF_APPLICATION_READS)
    .map((f) => {
      const start = src.indexOf(f.body);
      return { start, end: start + f.body.length };
    });
  const re = new RegExp(PERSONAL_COLUMN_READ.source, 'g');
  let total = 0;
  let stray = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    total += 1;
    const at = m.index;
    if (!loggedRanges.some((r) => r.start !== -1 && at >= r.start && at < r.end)) stray += 1;
  }
  check(
    'candidates-admin.ts: reads application personal columns somewhere (the check has a subject)',
    total > 0,
    'Expected listApplicationsForStaff() to select them. If the staff read moved, update this ' +
      'script with it rather than letting the check go vacuous.',
  );
  check(
    'candidates-admin.ts: every application personal column is read inside a logging export',
    stray === 0,
    `${stray} reference(s) outside a DISCLOSING / STAFF_APPLICATION_READS export body. Move the ` +
      'read into the exported function that logs it.',
  );
}

console.log('');
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(`PASS — candidate access construction holds (${functions.length} exports checked).`);
process.exit(0);
