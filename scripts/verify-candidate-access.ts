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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// ---------------------------------------------------------------------------
// Crude but sufficient body extraction: from one top-level `export ` to the
// next. The module is one flat file of top-level declarations, which is exactly
// the shape this handles correctly.
// ---------------------------------------------------------------------------

type Fn = { name: string; body: string };

function exportedFunctions(src: string): Fn[] {
  const out: Fn[] = [];
  const re = /^export async function (\w+)\(/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    const start = match.index;
    const nextExport = src.slice(start + 1).search(/^export /m);
    const end = nextExport === -1 ? src.length : start + 1 + nextExport;
    out.push({ name: match[1]!, body: src.slice(start, end) });
  }
  return out;
}

const functions = exportedFunctions(source);

console.log(`lib/db/candidates-admin.ts — ${functions.length} exported async function(s)\n`);
check('the module exports at least the four PR 7 + PR 12 functions', functions.length >= 4);

for (const fn of functions) {
  const known = DISCLOSING.has(fn.name) || fn.name in NON_DISCLOSING;
  check(
    `${fn.name}: is a known export`,
    known,
    'New exports must be classified in scripts/verify-candidate-access.ts as disclosing or not.',
  );

  // §2.4: role is checked as exactly `admin`, inside the function.
  check(`${fn.name}: calls requireAdmin(actor)`, fn.body.includes('requireAdmin(actor)'));

  if (DISCLOSING.has(fn.name)) {
    // §2.4: the reason is non-optional and validated before the read.
    check(`${fn.name}: validates the reason`, fn.body.includes('requireReason(reason)'));
    check(`${fn.name}: writes a data_access_logs row`, fn.body.includes('await logAccess('));

    // The log must come BEFORE the value is handed back. Comparing positions is
    // what makes this an ordering check rather than a presence check.
    const logAt = fn.body.indexOf('await logAccess(');
    const lastReturn = fn.body.lastIndexOf('return');
    check(
      `${fn.name}: logs before it returns the data`,
      logAt !== -1 && logAt < lastReturn,
      'The logAccess() call must precede the final return.',
    );
  }
}

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

console.log('');
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(`PASS — candidate access construction holds (${functions.length} exports checked).`);
process.exit(0);
