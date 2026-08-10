// Asserts the no-FK convention's other half, statically.
//
//   npm run cascade:verify
//
// lib/db/schema.ts declares no foreign keys anywhere, on purpose: the ARCO
// purge deliberately leaves some references dangling (a `consents` row outlives
// the candidate it authorised, `deletion_requests.candidate_id` outlives the
// row it names), and half-constrained referential integrity is worse than none.
// The price of that decision is that every cross-table cleanup lives in code,
// which means it can be forgotten — and a forgotten cleanup fails silently, the
// same class of failure scripts/verify-scoping.ts and
// scripts/verify-candidate-access.ts exist to catch.
//
// So this is the mechanical check for it: if a module hard-deletes a parent
// row, it must delete that parent's dependent rows too, and it must do so
// BEFORE the parent goes. Order matters on a crash — dependents first loses a
// bookmark, parent first leaves an orphan nobody can find by joining.
//
// Source-reading rather than executing, for the same reason as
// verify-candidate-access.ts: the property is about what the files may contain,
// and a runtime check would only cover the paths someone remembered to call.
// It fails on anything it does not recognise: a new `.delete(parent)` site in a
// file that is not listed below is a FAIL, so adding one is a decision instead
// of a diff.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DB_DIR = join(process.cwd(), 'lib/db');

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

// ---------------------------------------------------------------------------
// The dependency registry. One entry per table that has no FK protecting it,
// listing the parent tables whose deletion must clean it up. Adding a table to
// schema.ts that points at another table means adding it here.
// ---------------------------------------------------------------------------

type Dependency = {
  /** The Drizzle export name of the dependent table. */
  child: string;
  /** Drizzle export names of parents whose hard delete must purge `child`. */
  parents: string[];
};

const DEPENDENCIES: Dependency[] = [
  // A bookmark is meaningless without its job, and must not outlive the
  // candidate who made it (PLAN-PHASE3-DRAFT.md §1, §4 point 2).
  { child: 'savedJobs', parents: ['jobs', 'candidates'] },
];

/**
 * Rows that are deliberately left pointing at an id that no longer resolves.
 * Listed so that "this parent has no registered dependents" is a stated
 * decision rather than an omission — see candidate-arco.ts step 6.
 */
const DELIBERATE_ORPHANS: Record<string, string> = {
  consents: 'proof of what was authorised; survives the candidate by design (§4.3, 5 years)',
  deletionRequests: 'the record that the candidate row was destroyed; cannot reference it',
  dataAccessLogs: 'audit of staff reads; purged on its own retention clock, not with the subject',
  applications: 'redacted to a husk rather than deleted, so employer/admin counts stay coherent',
};

// ---------------------------------------------------------------------------

function sourceFiles(): { path: string; name: string; source: string }[] {
  return readdirSync(DB_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((name) => ({
      name,
      path: join(DB_DIR, name),
      source: readFileSync(join(DB_DIR, name), 'utf8'),
    }));
}

/** Byte offsets of every `.delete(<table>)` call in `source`. */
function deleteOffsets(source: string, table: string): number[] {
  const needle = `.delete(${table})`;
  const offsets: number[] = [];
  for (let i = source.indexOf(needle); i !== -1; i = source.indexOf(needle, i + 1)) {
    offsets.push(i);
  }
  return offsets;
}

const files = sourceFiles();

// ---------------------------------------------------------------------------
// 1. The convention itself: no FK constraints in the schema.
// ---------------------------------------------------------------------------

const schema = files.find((f) => f.name === 'schema.ts');
if (!schema) {
  console.error('lib/db/schema.ts not found.');
  process.exit(1);
}

check(
  'schema.ts declares no foreign keys',
  !/\.references\s*\(/.test(schema.source),
  'A `.references()` here would make this the only constrained table in the schema. ' +
    'Either the whole schema gets FKs or none of it does — see the saved_jobs note in schema.ts.',
);

// ---------------------------------------------------------------------------
// 2. Every parent delete cleans up its dependents, first.
// ---------------------------------------------------------------------------

for (const { child, parents } of DEPENDENCIES) {
  for (const parent of parents) {
    const sites = files.filter((f) => f.name !== 'schema.ts' && deleteOffsets(f.source, parent).length > 0);

    check(
      `${parent} is hard-deleted in at least one module (registry is not stale)`,
      sites.length > 0,
      `No .delete(${parent}) found in lib/db. If that path moved, update DEPENDENCIES.`,
    );

    for (const file of sites) {
      const parentAt = Math.min(...deleteOffsets(file.source, parent));
      const childOffsets = deleteOffsets(file.source, child);

      check(
        `${file.name} deletes ${child} where it deletes ${parent}`,
        childOffsets.length > 0,
        `.delete(${parent}) in ${file.name} leaves ${child} rows pointing at a row that is gone. ` +
          `There is no FK to clean them up.`,
      );

      if (childOffsets.length > 0) {
        check(
          `${file.name} deletes ${child} before ${parent}`,
          Math.min(...childOffsets) < parentAt,
          `A crash between the two statements should lose the dependent row, not orphan it. ` +
            `Move the .delete(${child}) above the .delete(${parent}).`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The deliberate orphans are still deliberate — printed, not asserted, so
//    the run reads as a complete account of the schema's dangling references.
// ---------------------------------------------------------------------------

console.log('\ndeliberately unconstrained (no cleanup expected):');
for (const [table, reason] of Object.entries(DELIBERATE_ORPHANS)) {
  console.log(`      ${table}: ${reason}`);
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll cascade assertions passed.');
process.exit(0);
