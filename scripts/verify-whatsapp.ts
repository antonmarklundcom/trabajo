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
// ---------------------------------------------------------------------------

const ALLOWED_EVENTS = ['whatsapp_click', 'lead_submit'];
const trackCallRe = /\btrack\(\s*(['"`])([^'"`]*)\1/g;

let trackCallCount = 0;
let untypedCallFound = false;

for (const file of files) {
  if (file === 'lib/analytics.ts') continue; // the overload declarations themselves
  const source = code(read(file));
  let match: RegExpExecArray | null;
  trackCallRe.lastIndex = 0;
  while ((match = trackCallRe.exec(source)) !== null) {
    trackCallCount += 1;
    const eventName = match[2];
    if (!ALLOWED_EVENTS.includes(eventName)) {
      untypedCallFound = true;
      console.log(`        ${file}: track('${eventName}', ...) is not in {${ALLOWED_EVENTS.join(', ')}}`);
    }
  }
  // A cast around the overloads would defeat the whole point.
  if (/track\([^)]*as\s+(any|never|typeof)/.test(source)) {
    untypedCallFound = true;
    console.log(`        ${file}: track(...) call routes around the typed overloads with a cast`);
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
