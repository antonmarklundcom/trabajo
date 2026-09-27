// Asserts three account-safety properties that are invisible in a browser:
//
//   npm run accounts:verify
//
// 1. A password write ends every existing session. Both session lookups
//    (lib/auth.ts, lib/auth-candidate.ts) compare the cookie's sessionVersion
//    against the row, and EVERY statement in app/, lib/ or scripts/ that
//    writes a password hash increments session_version in that same SET. The
//    failure mode is silent: the reset "works", the owner logs in with the new
//    password, and the attacker's cookie keeps working for 7 or 30 days.
// 2. Registration is atomic. registerEmployer() and registerCandidate() do all
//    their writes on one transaction handle, map a racing duplicate email to
//    the same answer the pre-check gives, and the route handlers send mail
//    only after the call — i.e. after COMMIT. A half-finished signup is an
//    account without the consent row that proves it was authorised, and it
//    looks exactly like a complete one.
// 3. Google Analytics never receives a token-bearing URL. Account areas send
//    no page_view, only allowlisted query parameters survive, and nothing
//    else on the site configures gtag or sends a page_view behind the
//    sanitizer's back. A leaked token sits in a vendor's event store, which is
//    the one place nobody here would ever look.
//
// No database, no env, no network: source-reading plus two pure modules
// (lib/analytics-location.ts, lib/db/duplicate-key.ts) exercised directly,
// like scripts/verify-moderation.ts and scripts/verify-whatsapp.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACCOUNT_PATH_PREFIXES,
  ALLOWED_QUERY_PARAMS,
  isTrackablePath,
  sanitizePageLocation,
  sanitizeReferrer,
} from '../lib/analytics-location';
import { isDuplicateKeyOn } from '../lib/db/duplicate-key';

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
 * Source with comments removed, so that prose explaining a property can never
 * satisfy (or break) the check for it. The lookbehind keeps `https://` inside
 * string literals intact, as in scripts/verify-whatsapp.ts.
 */
function code(source: string): string {
  return source.replace(/(?<!:)\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** From `marker` to the first line that closes a top-level block. */
function bodyFrom(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.search(/\n\}\)?;?\n/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The text between the parenthesis at `open` and its matching close. */
function balancedArgs(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

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

const SOURCE_FILES = ['app', 'components', 'lib', 'scripts'].flatMap(walk);

// ===========================================================================
// 1. Sessions die when the password changes
// ===========================================================================

const auth = code(read('lib/auth.ts'));
const authCandidate = code(read('lib/auth-candidate.ts'));

const staffLookup = bodyFrom(auth, 'export const getSessionUser');
check(
  'lib/auth.ts getSessionUser() compares the cookie sessionVersion in its WHERE',
  /const sessionVersion = session\.sessionVersion \?\? 0;/.test(staffLookup) &&
    /\.where\([\s\S]*eq\(schema\.users\.sessionVersion, sessionVersion\)[\s\S]*\)/.test(staffLookup),
  'Without it a reset leaves every existing staff/employer cookie valid for 7 days. A ' +
    'missing version must read as 0 (the column default) so the deploy logs nobody out.',
);

const candidateLookup = bodyFrom(authCandidate, 'export const getCandidate');
check(
  'lib/auth-candidate.ts getCandidate() compares the cookie sessionVersion in its WHERE',
  /const sessionVersion = session\.sessionVersion \?\? 0;/.test(candidateLookup) &&
    /\.where\([\s\S]*eq\(schema\.candidates\.sessionVersion, sessionVersion\)[\s\S]*\)/.test(
      candidateLookup,
    ),
  'Without it a reset leaves every existing candidate cookie valid for 30 days.',
);

check(
  'createSession() and createCandidateSession() seal the version they are given',
  /session\.sessionVersion = sessionVersion;/.test(bodyFrom(auth, 'export async function createSession(')) &&
    /session\.sessionVersion = sessionVersion;/.test(
      bodyFrom(authCandidate, 'export async function createCandidateSession('),
    ),
);

check(
  'authenticate() and authenticateCandidate() read session_version from the row they verified',
  /sessionVersion: schema\.users\.sessionVersion/.test(bodyFrom(auth, 'export async function authenticate(')) &&
    /sessionVersion: schema\.candidates\.sessionVersion/.test(
      bodyFrom(authCandidate, 'export async function authenticateCandidate('),
    ),
  'The version sealed at login must be the one the password was checked against.',
);

// Every `.set({...})` anywhere that names passwordHash must bump the version in
// the same object — i.e. the same UPDATE statement. Collected rather than
// hardcoded, so a NEW password write site is covered the day it is added.
const BUMP = /sessionVersion:\s*sql`\$\{[\w.]+\.sessionVersion\}\s*\+\s*1`/;
const passwordWriteSites: string[] = [];
const unbumped: string[] = [];
for (const file of SOURCE_FILES) {
  if (file === 'scripts/verify-accounts.ts') continue;
  const source = code(read(file));
  const setRe = /\.set\(/g;
  let m: RegExpExecArray | null;
  while ((m = setRe.exec(source)) !== null) {
    const args = balancedArgs(source, m.index + '.set'.length);
    if (!/\bpasswordHash\b/.test(args)) continue;
    passwordWriteSites.push(file);
    if (!BUMP.test(args)) unbumped.push(file);
  }
  // The two other shapes a hash write could take, neither of which the loop
  // above would see: an upsert, and hand-written SQL.
  if (/onDuplicateKeyUpdate\([\s\S]*?passwordHash/.test(source)) unbumped.push(`${file} (upsert)`);
  if (/UPDATE[^;`]*password_hash/i.test(source)) unbumped.push(`${file} (raw SQL)`);
}

check(
  'every password-hash UPDATE also increments session_version in the same SET',
  unbumped.length === 0,
  `Unbumped write(s) in: ${unbumped.join(', ')}. Add ` +
    "sessionVersion: sql`${table.sessionVersion} + 1` to that .set({...}).",
);

const EXPECTED_WRITE_SITES = [
  'lib/db/candidate-profile.ts',
  'lib/db/employer-password.ts',
  'scripts/set-password.ts',
];
check(
  'the password-hash UPDATE sites are exactly the three known ones',
  JSON.stringify([...new Set(passwordWriteSites)].sort()) === JSON.stringify(EXPECTED_WRITE_SITES),
  `Found: ${[...new Set(passwordWriteSites)].sort().join(', ') || '(none)'}. A site disappearing ` +
    'means this scan stopped seeing it (the check above would then pass vacuously); a new one ' +
    'must be reviewed and added here.',
);

// The two reset flows must seal the version the password write returned, so
// the resetter's own new session is the one that survives.
const employerConfirm = code(read('app/api/empresa/recuperar/confirmar/route.ts'));
const candidateConfirm = code(read('app/api/postulante/recuperar/confirmar/route.ts'));
check(
  'both password-reset routes sign in with the version the password write returned',
  /const sessionVersion = await setEmployerPassword\(/.test(employerConfirm) &&
    /createSession\(redeemed\.userId, sessionVersion\)/.test(employerConfirm) &&
    /const sessionVersion = await setCandidatePassword\(/.test(candidateConfirm) &&
    /createCandidateSession\(redeemed\.candidateId, sessionVersion\)/.test(candidateConfirm),
);

const migrations = readdirSync(join(ROOT, 'drizzle'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => read(`drizzle/${f}`))
  .join('\n');
check(
  'a migration adds session_version (NOT NULL DEFAULT 0) to users and candidates',
  /ALTER TABLE `users` ADD `session_version` int DEFAULT 0 NOT NULL/.test(migrations) &&
    /ALTER TABLE `candidates` ADD `session_version` int DEFAULT 0 NOT NULL/.test(migrations),
);

// ===========================================================================
// 2. Registration is one transaction
// ===========================================================================

const signup = code(read('lib/db/employer-signup.ts'));
const profile = code(read('lib/db/candidate-profile.ts'));

function assertAtomicRegistration(label: string, body: string, table: string, index: string): void {
  const txStart = body.indexOf('db.transaction(async (tx) =>');
  const txBody = txStart === -1 ? '' : body.slice(txStart);
  check(
    `${label} runs its writes inside db.transaction()`,
    txStart !== -1 && new RegExp(`tx\\.insert\\(${table}\\)`).test(txBody) && /tx\.insert\(consents\)/.test(txBody),
    'The account row and its consent row are one fact; written separately, a failure between ' +
      'them leaves an account nobody can show consent for.',
  );
  check(
    `${label} makes no write outside the transaction handle`,
    !/\bdb\.(insert|update|delete)\(/.test(body),
    'A write on `db` instead of `tx` escapes the transaction and survives its rollback.',
  );
  check(
    `${label} maps a racing duplicate on ${index} to email_taken`,
    new RegExp(`isDuplicateKeyOn\\(err, '${index}'\\)\\) return \\{ ok: false, reason: 'email_taken' \\}`).test(body),
  );
  check(`${label} sends no email itself (mail goes out after COMMIT, from the route)`, !/sendEmail/.test(body));
}

assertAtomicRegistration(
  'registerEmployer()',
  bodyFrom(signup, 'export async function registerEmployer('),
  'users',
  'users_email_unique',
);
assertAtomicRegistration(
  'registerCandidate()',
  bodyFrom(profile, 'export async function registerCandidate('),
  'candidates',
  'candidates_email_unique',
);

for (const [route, fn] of [
  ['app/api/empresa/registro/route.ts', 'registerEmployer('],
  ['app/api/postulante/registro/route.ts', 'registerCandidate('],
] as const) {
  const source = code(read(route));
  const call = source.indexOf(`await ${fn}`);
  const mail = source.indexOf('sendEmail(');
  check(
    `${route} sends mail only after ${fn.slice(0, -1)}() has returned`,
    call !== -1 && mail !== -1 && call < mail,
  );
}

// The race handling reads through drizzle's wrapper. drizzle-orm rethrows every
// failed query as a DrizzleQueryError whose `cause` is the mysql2 error; a check
// on the top-level `code` never matches.
const wrappedDup = {
  message: 'Failed query: insert into `users` ...',
  cause: {
    code: 'ER_DUP_ENTRY',
    errno: 1062,
    message: "Duplicate entry 'a@b.py' for key 'users.users_email_unique'",
  },
};
check(
  'isDuplicateKeyOn() sees a duplicate wrapped in DrizzleQueryError.cause',
  isDuplicateKeyOn(wrappedDup, 'users_email_unique'),
);
check(
  'isDuplicateKeyOn() does not match a duplicate on a different index',
  !isDuplicateKeyOn(wrappedDup, 'companies_slug_unique') &&
    !isDuplicateKeyOn({ cause: { code: 'ER_LOCK_DEADLOCK', message: 'users_email_unique' } }, 'users_email_unique'),
);

const snapshots = readdirSync(join(ROOT, 'drizzle/meta')).filter((f) => f.endsWith('_snapshot.json')).sort();
const latestSnapshot = read(`drizzle/meta/${snapshots[snapshots.length - 1]}`);
check(
  'the unique indexes the race handling names exist in the latest schema snapshot',
  latestSnapshot.includes('"users_email_unique"') && latestSnapshot.includes('"candidates_email_unique"'),
  'isDuplicateKeyOn() matches by index name; a renamed index would make every race a 500.',
);

// ===========================================================================
// 3. Analytics never receives a token-bearing URL
// ===========================================================================

const ORIGIN = 'https://trabajo.com.py';

// Every page under app/ that reads a `token` is, by construction, a page whose
// URL carries a secret. Discovered rather than listed, so a new one is covered.
function routeOf(pageFile: string): string {
  const segments = pageFile
    .replace(/^app/, '')
    .replace(/\/page\.tsx$/, '')
    .split('/')
    .filter((s) => s && !/^\(.*\)$/.test(s));
  return `/${segments.join('/')}`;
}
const tokenPages = walk('app')
  .filter((f) => f.endsWith('/page.tsx') && /\btoken\b/.test(code(read(f))))
  .map(routeOf);

check('found the token-bearing pages to test', tokenPages.length >= 5, `found: ${tokenPages.join(', ')}`);
for (const route of tokenPages) {
  const location = sanitizePageLocation(ORIGIN, route, '?token=SECRET123&q=x');
  check(
    `${route}?token=… is not measured and its location carries no token`,
    !isTrackablePath(route) && !location.includes('SECRET123') && !location.includes('token'),
    `isTrackablePath=${isTrackablePath(route)}, location=${location}`,
  );
}

for (const prefix of ACCOUNT_PATH_PREFIXES) {
  check(`${prefix} and ${prefix}/… send no page_view`, !isTrackablePath(prefix) && !isTrackablePath(`${prefix}/x`));
}
check(
  'public pages are measured, and a prefix only matches a whole segment',
  ['/', '/empleos', '/empleos/cajero-asuncion', '/blog/x', '/trabajo-en/asuncion', '/adminx'].every(
    isTrackablePath,
  ),
);

const listing = sanitizePageLocation(
  ORIGIN,
  '/empleos',
  '?q=cajero&token=SECRET123&ciudad=asuncion&email=a%40b.py&page=2&utm_source=fb',
);
check(
  'a public location keeps only allowlisted parameters',
  listing === `${ORIGIN}/empleos?q=cajero&ciudad=asuncion&page=2&utm_source=fb`,
  `got ${listing}`,
);
check(
  'a same-origin referrer is sanitized; a cross-origin one is reduced to its origin',
  sanitizeReferrer(`${ORIGIN}/postulante/verificar?token=SECRET123`, ORIGIN) === `${ORIGIN}/postulante/verificar` &&
    sanitizeReferrer('https://mail.example.com/inbox?msg=SECRET123', ORIGIN) === 'https://mail.example.com/',
);

check('the query-parameter allowlist never contains token', !ALLOWED_QUERY_PARAMS.has('token'));

// The allowlist is the listing's real filter names plus utm_*. Read from the
// page (not edited here) so a renamed filter is noticed.
const listingPage = read('app/empleos/page.tsx');
const listingNames = new Set([...listingPage.matchAll(/param\(sp, '(\w+)'\)/g)].map((m) => m[1]!));
const allowedNonUtm = [...ALLOWED_QUERY_PARAMS].filter((p) => !p.startsWith('utm_'));
check(
  'the non-utm allowlist is exactly the listing filters app/empleos/page.tsx reads',
  listingNames.size > 0 &&
    allowedNonUtm.length === listingNames.size &&
    allowedNonUtm.every((p) => listingNames.has(p)),
  `allowlist: ${allowedNonUtm.join(', ')}; page reads: ${[...listingNames].join(', ')}`,
);

const loader = code(read('components/Analytics.tsx'));
const pageViews = code(read('components/AnalyticsPageViews.tsx'));
check(
  'components/Analytics.tsx has no inline gtag config (which would send an automatic raw page_view)',
  !/gtag\(/.test(loader) && !/dangerouslySetInnerHTML/.test(loader) && !/<Script id=/.test(loader),
);
check(
  'AnalyticsPageViews configures gtag with send_page_view: false',
  /gtag\('config', gaId, \{\s*send_page_view: false,/.test(pageViews),
);
check(
  'AnalyticsPageViews sends page_view only inside the trackable branch, with the sanitized location',
  /if \(trackable\) \{\s*gtag\('event', 'page_view', \{ page_location: location, page_referrer: referrer \}\);\s*\}/.test(
    pageViews,
  ) && (pageViews.match(/'page_view'/g) ?? []).length === 1,
);
check(
  'AnalyticsPageViews disables GA outright in account areas and pins the sanitized location',
  /w\[`ga-disable-\$\{gaId\}`\] = !trackable;/.test(pageViews) &&
    /const trackable = isTrackablePath\(pathname\);/.test(pageViews) &&
    /const location = sanitizePageLocation\(origin, pathname, search\);/.test(pageViews) &&
    /gtag\('set', \{ page_location: location, page_referrer: referrer \}\);/.test(pageViews),
);

const analyticsLib = code(read('lib/analytics.ts'));
check(
  'track() states the sanitized page_location on the event instead of letting gtag attach the raw URL',
  /page_location: sanitizePageLocation\(origin, pathname, search\)/.test(analyticsLib),
);

// Nobody else talks to gtag: a second call site is a second place a raw URL or
// an unsanitized page_view could come from.
const GTAG_FILES = new Set([
  'components/Analytics.tsx', // loads the library (the gtag/js URL) and nothing else, asserted above
  'components/AnalyticsPageViews.tsx',
  'lib/analytics.ts',
]);
const strayGtag = walk('app')
  .concat(walk('components'), walk('lib'))
  .filter((f) => !GTAG_FILES.has(f) && /\bgtag\b|dataLayer|page_view/.test(code(read(f))));
check(
  'only AnalyticsPageViews and lib/analytics.ts touch gtag / dataLayer / page_view',
  strayGtag.length === 0,
  `also found in: ${strayGtag.join(', ')}`,
);

console.log('');
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log('All account checks passed.');
}
