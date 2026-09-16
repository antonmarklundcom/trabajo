// Asserts the two rules AGENTS.md adds for Batch W (PLAN-GROWTH.md §1, §4 W1):
//
//   npm run whatsapp:verify
//
// 1. Every `wa.me` link is built by lib/whatsapp.ts. A page or component that
//    concatenates `https://wa.me/` itself is exactly the config drift
//    (PLAN-GROWTH.md §2.2 finding 8/9) this module exists to close, and
//    nothing about that mistake is visible in a browser — the link still
//    opens WhatsApp, it just does it from a second place that the next
//    number or message change forgets to touch.
// 2. `lead_submit` / `whatsapp_click` are the only two analytics event names
//    on the site. `lib/analytics.ts`'s overloads make an unknown event name
//    a type error; this script asserts no call site routes around that with
//    an `as` cast or a literal outside the two names.
//
// No database, no env, no network — source-reading only, like
// scripts/verify-moderation.ts and scripts/verify-seo.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

function code(source: string): string {
  // Negative lookbehind on ':' so a real `https://`/`http://` literal inside a
  // string or template — the whole point of this file — survives stripping;
  // a genuine `//` comment is never preceded by a colon.
  return source.replace(/(?<!:)\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (SKIP_DIRS.has(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(walk);

// ---------------------------------------------------------------------------
// 1. The literal `wa.me` appears in exactly one file.
// ---------------------------------------------------------------------------

const waMeFiles = files.filter((f) => code(read(f)).includes('wa.me'));

check(
  'https://wa.me/ is written in exactly one file (lib/whatsapp.ts)',
  waMeFiles.length === 1 && waMeFiles[0] === 'lib/whatsapp.ts',
  `found in: ${waMeFiles.join(', ') || '(nowhere)'}`,
);

// ---------------------------------------------------------------------------
// 2. Every track(...) call site uses one of the two typed event names.
//
// tsc already rejects a literal outside the two overloads, so the practical
// bypass is an alias this script does not recognise as "track" at all
// (`import { track as t }`, `import * as analytics from '.../analytics'`
// then `analytics.track(...)`) or a non-literal first argument, which could
// be a variable already widened past the literal union by a cast made
// somewhere else in the file. Both used to pass through unnoticed: an aliased
// call was never matched by the `track(` regex, so it added zero to
// trackCallCount and was never inspected at all.
// ---------------------------------------------------------------------------

const ALLOWED_EVENTS = ['whatsapp_click', 'lead_submit'];

/** Every local name that can call the real track(): the export itself, any
 *  `{ track as x }` alias, and `x.track(` for any `import * as x` from the
 *  same module. */
function trackCallableNames(source: string): string[] {
  const names = new Set<string>(['track']);
  const namedRe = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/analytics['"]/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(source)) !== null) {
    for (const part of m[1]!.split(',')) {
      const alias = part.trim().match(/^track\s+as\s+(\w+)$/);
      if (alias) names.add(alias[1]!);
    }
  }
  const namespaceRe = /import\s*\*\s*as\s+(\w+)\s*from\s*['"][^'"]*\/analytics['"]/g;
  while ((m = namespaceRe.exec(source)) !== null) {
    names.add(`${m[1]}.track`);
  }
  return [...names];
}

let trackCallCount = 0;
let untypedCallFound = false;

for (const file of files) {
  if (file === 'lib/analytics.ts') continue; // the overload declarations themselves
  const source = code(read(file));

  for (const name of trackCallableNames(source)) {
    const escaped = name.replace(/\./g, '\\.');
    // Literal call: `<name>('event', ...)`. Anything else after `<name>(` —
    // a variable, a template literal, a function call — is a non-literal
    // argument this script cannot verify statically, and is flagged rather
    // than silently skipped.
    const callRe = new RegExp(`\\b${escaped}\\(\\s*(?:(['"\`])([^'"\`]*)\\1)?`, 'g');
    let match: RegExpExecArray | null;
    while ((match = callRe.exec(source)) !== null) {
      trackCallCount += 1;
      if (match[1] === undefined) {
        untypedCallFound = true;
        console.log(
          `        ${file}: ${name}(...) called with a non-literal first argument — ` +
            'the event name cannot be verified statically, review by hand',
        );
        continue;
      }
      const eventName = match[2];
      if (!ALLOWED_EVENTS.includes(eventName!)) {
        untypedCallFound = true;
        console.log(`        ${file}: ${name}('${eventName}', ...) is not in {${ALLOWED_EVENTS.join(', ')}}`);
      }
    }

    // A cast around the overloads would defeat the whole point. Broadened to
    // the alias/namespace form too, and to `string` — the widest cast that
    // would let an arbitrary literal through.
    if (new RegExp(`${escaped}\\([^)]*as\\s+(any|never|typeof|string)\\b`).test(source)) {
      untypedCallFound = true;
      console.log(`        ${file}: ${name}(...) call routes around the typed overloads with a cast`);
    }
  }
}

check('every track() call site found at least one usage', trackCallCount > 0);
check('every track() call uses whatsapp_click or lead_submit', !untypedCallFound);

// ---------------------------------------------------------------------------
// 3. .env.example documents the number the whole module depends on.
// ---------------------------------------------------------------------------

check(
  '.env.example documents NEXT_PUBLIC_WHATSAPP_LEADS',
  read('.env.example').includes('NEXT_PUBLIC_WHATSAPP_LEADS'),
);

// ---------------------------------------------------------------------------
// 4. lib/whatsapp.ts exports the one hours-copy constant every page reuses.
// ---------------------------------------------------------------------------

check(
  'lib/whatsapp.ts exports WHATSAPP_HOURS_COPY',
  /export const WHATSAPP_HOURS_COPY/.test(code(read('lib/whatsapp.ts'))),
);

console.log('');
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log('All whatsapp checks passed.');
}
