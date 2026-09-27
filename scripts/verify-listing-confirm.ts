// Asserts the "¿Tu aviso sigue abierto?" links (lib/listing-confirm.ts,
// scripts/listing-confirm.ts, /empresa/confirmar-aviso).
//
//   npm run listings-confirm:verify
//
// Why a script. A signed link that accepts a tampered job id, or a page that
// acts on GET, works perfectly in every manual test: the employer clicks, the
// listing renews. The failures only show up as a listing someone else renewed,
// or one a mail scanner closed before the employer ever read the email — and
// neither leaves a trace in a browser.
//
// Two halves:
//   1. The token, by evaluation: round trip, tampering with each signed field,
//      age limit, and the "old expires_at" rule that makes a link single-use.
//   2. The wiring, by reading source: the "sí" path renews through
//      computeRenewedExpiry() and never writes a status or featured_until, the
//      "cerralo" path writes only `archived`, both are companyId-scoped
//      compare-and-swaps, the GET page cannot write, the POST route goes
//      through the scoped functions, and the sending script is dry-run unless
//      told otherwise.
//
// No database, no network. SESSION_SECRET is not read: every call passes a key.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

import {
  LISTING_CONFIRM_TOKEN_TTL_MS,
  listingConfirmKey,
  sameExpiry,
  signListingConfirmToken,
  verifyListingConfirmToken,
  type ListingConfirmPayload,
} from '../lib/listing-confirm';
import { computeRenewedExpiry, LISTING_DAYS } from '../lib/listing-expiry';

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

/** Source without comments — the prose in these files names what the code must not do. */
function code(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The body of `function <name>(`, up to the first closing brace at column 0. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.indexOf('\n}');
  return end === -1 ? rest : rest.slice(0, end);
}

// ---------------------------------------------------------------------------
// 1. The token
// ---------------------------------------------------------------------------

const SECRET = 'verify-listing-confirm-secret-0123456789abcdef';
const key = listingConfirmKey(SECRET);
const DAY = 24 * 60 * 60 * 1000;
const issuedAt = new Date('2026-09-27T12:00:00.000Z');
const expiresAt = new Date('2026-10-02T15:30:00.000Z');
const payload: ListingConfirmPayload = { jobId: 42, action: 'open', expiresAt, issuedAt };
const token = signListingConfirmToken(payload, key);
const at = (ms: number) => new Date(issuedAt.getTime() + ms);

check(
  'the key is derived for this purpose, not the raw secret',
  key.equals(createHmac('sha256', SECRET).update('listing-confirm').digest()) &&
    !key.equals(Buffer.from(SECRET)),
  'Expected key = HMAC-SHA256(SESSION_SECRET, "listing-confirm").',
);

check('a short secret is refused', (() => {
  try {
    listingConfirmKey('too-short');
    return false;
  } catch {
    return true;
  }
})());

{
  const verdict = verifyListingConfirmToken(token, at(60_000), key);
  check(
    'round trip: a fresh token verifies with the same job, action and expiry',
    verdict.ok &&
      verdict.payload.jobId === 42 &&
      verdict.payload.action === 'open' &&
      verdict.payload.expiresAt.getTime() === expiresAt.getTime() &&
      verdict.payload.issuedAt.getTime() === issuedAt.getTime(),
    JSON.stringify(verdict),
  );
}

{
  const close = signListingConfirmToken({ ...payload, action: 'close' }, key);
  const verdict = verifyListingConfirmToken(close, at(60_000), key);
  check('round trip: the close action verifies as close', verdict.ok && verdict.payload.action === 'close');
}

const parts = token.split('.');
const withPart = (index: number, value: string) => parts.map((p, i) => (i === index ? value : p)).join('.');
const rejected = (t: string, now = at(60_000)) => {
  const v = verifyListingConfirmToken(t, now, key);
  return !v.ok && v.reason === 'invalid';
};

check('tampered jobId is rejected', rejected(withPart(0, '43')));
check('tampered action is rejected', rejected(withPart(1, 'close')));
check('tampered expiresAt is rejected', rejected(withPart(2, String(Number(parts[2]) + 30 * 86_400))));
// Earlier, not later: a later issuedAt would also trip the future-issue check
// and hide whether the signature covers the field at all.
check('tampered issuedAt is rejected', rejected(withPart(3, String(Number(parts[3]) - 3_600))));
check(
  'tampered signature is rejected',
  rejected(withPart(4, (parts[4][0] === 'A' ? 'B' : 'A') + parts[4].slice(1))),
);
check('a token signed with another secret is rejected', (() => {
  const other = signListingConfirmToken(payload, listingConfirmKey(`${SECRET}-other`));
  return rejected(other);
})());
check('garbage and empty strings are rejected', rejected('') && rejected('a.b.c.d.e') && rejected(`${token}x`));

{
  const inside = verifyListingConfirmToken(token, at(LISTING_CONFIRM_TOKEN_TTL_MS - 1000), key);
  const outside = verifyListingConfirmToken(token, at(LISTING_CONFIRM_TOKEN_TTL_MS + 1000), key);
  check(
    'a token is honoured for 14 days and not after',
    LISTING_CONFIRM_TOKEN_TTL_MS === 14 * DAY && inside.ok && !outside.ok && outside.reason === 'expired',
    `inside=${JSON.stringify(inside)} outside=${JSON.stringify(outside)}`,
  );
}

check(
  'a token issued in the future (beyond clock skew) is rejected',
  rejected(token, new Date(issuedAt.getTime() - 60 * 60 * 1000)),
);

{
  // The single-use rule. After the "sí" path renews the listing, the row's
  // expires_at moves; the link minted for the old value no longer matches it.
  const renewed = computeRenewedExpiry(at(60_000), expiresAt, LISTING_DAYS);
  check(
    'a token for an old expires_at no longer matches the row after a renewal',
    sameExpiry(expiresAt, expiresAt) &&
      !sameExpiry(renewed, expiresAt) &&
      !sameExpiry(null, expiresAt) &&
      renewed.getTime() === expiresAt.getTime() + LISTING_DAYS * DAY,
  );
}

const tokenModule = code(read('lib/listing-confirm.ts'));
check(
  'the signature comparison is constant-time',
  /timingSafeEqual\(given, expected\)/.test(tokenModule) && !/given\.equals\(|=== expected/.test(tokenModule),
);

// ---------------------------------------------------------------------------
// 2. The wiring
// ---------------------------------------------------------------------------

const employer = code(read('lib/db/employer.ts'));
const renewBody = functionBody(employer, 'renewEmployerListingFromEmail');
const closeBody = functionBody(employer, 'closeEmployerListingFromEmail');

for (const [name, body] of [
  ['renewEmployerListingFromEmail', renewBody],
  ['closeEmployerListingFromEmail', closeBody],
] as const) {
  check(`${name}() exists in lib/db/employer.ts`, body.length > 0);
  check(
    `${name}() takes companyId first and scopes its UPDATE on it`,
    new RegExp(`export async function ${name}\\(\\s*companyId: number`).test(employer) &&
      body.includes('ownedByCompany(companyId)'),
    "lib/db/employer.ts's contract (AGENTS.md): companyId first, and in the WHERE clause.",
  );
  check(
    `${name}() is a compare-and-swap on the signed expiry of a published job`,
    body.includes('eq(jobs.expiresAt, signedExpiresAt)') &&
      body.includes("eq(jobs.status, 'published')") &&
      body.includes('affectedRows === 0'),
    'Without the expiry in the WHERE clause a link is not single-use; without the status, ' +
      'a link could act on a job admin has since unpublished.',
  );
  check(`${name}() never writes featuredUntil`, !/featuredUntil/.test(body));
}

check(
  'the "sí" path renews through computeRenewedExpiry(…, LISTING_DAYS)',
  /computeRenewedExpiry\(now, signedExpiresAt, LISTING_DAYS\)/.test(renewBody),
  'The listing arithmetic lives once, in lib/listing-expiry.ts.',
);
check(
  'the "sí" path writes no status at all',
  !/status:\s*/.test(renewBody) && /\.set\(\{ expiresAt, updatedAt: now \}\)/.test(renewBody),
  "Renewing must never change status — in particular it must never write 'published'.",
);
check(
  "the \"cerralo\" path writes status 'archived' and nothing else",
  /\.set\(\{ status: 'archived', updatedAt: now \}\)/.test(closeBody) &&
    (closeBody.match(/status:\s*/g) ?? []).length === 1,
);
check(
  "lib/db/employer.ts still has no unconditional status: 'published'",
  !/status:\s*'published'/.test(employer),
);

const lookup = code(read('lib/db/listing-confirm.ts'));
check(
  'lib/db/listing-confirm.ts never updates or deletes, and inserts only into activity_log',
  !/\.update\(|\.delete\(/.test(lookup) &&
    (lookup.match(/\.insert\(/g) ?? []).length === 1 &&
    lookup.includes('.insert(activityLog)'),
  'The unscoped lookup module is read-only for jobs; job writes live in lib/db/employer.ts.',
);

const page = code(read('app/empresa/confirmar-aviso/page.tsx'));
check(
  'the GET page performs no write',
  !/lib\/db\/employer|lib\/cache|renewEmployer|closeEmployer|invalidatePublicContent|recordConfirmationSent|\.insert\(|\.update\(|\.delete\(|'use server'|fetch\(/.test(
    page,
  ),
  'Mail scanners fetch every link in an email. The page may read; the answer is a POST.',
);
check(
  "the page's button does not POST on mount",
  !/useEffect|useLayoutEffect/.test(code(read('components/empresa/ListingConfirmForm.tsx'))),
  'A POST fired from an effect is a GET with extra steps — a scanner that renders JS would answer.',
);
check(
  'the page is noindex and sends no referrer',
  page.includes('robots: { index: false, follow: false }') && page.includes("referrer: 'no-referrer'"),
);

const route = code(read('app/api/empresa/confirmar-aviso/route.ts'));
check('the redeem route exports POST only', /export async function POST\(/.test(route) && !/export (async )?function (GET|PUT|PATCH|DELETE)\b/.test(route));
check(
  'the POST calls the companyId-scoped functions with the job row\'s companyId',
  route.includes('renewEmployerListingFromEmail(job.companyId, jobId, expiresAt)') &&
    route.includes('closeEmployerListingFromEmail(job.companyId, jobId, expiresAt)'),
);
check(
  'the POST checks the rate limit and the signature before touching the database',
  route.indexOf('isListingConfirmLimited(') !== -1 &&
    route.indexOf('isListingConfirmLimited(') < route.indexOf('verifyListingConfirmToken(') &&
    route.indexOf('verifyListingConfirmToken(') < route.indexOf('findListingConfirmTarget('),
);
check(
  'the POST invalidates public content after each write',
  (route.match(/invalidatePublicContent\(\)/g) ?? []).length === 2,
);

const script = code(read('scripts/listing-confirm.ts'));
{
  const guard = script.indexOf('if (!apply) {');
  const firstSend = script.indexOf('sendEmail(');
  const firstRecord = script.indexOf('recordConfirmationSent(');
  check(
    'the sending script is a dry run unless --apply is passed',
    /const apply = argv\.includes\('--apply'\);/.test(script) &&
      guard !== -1 &&
      /if \(!apply\) \{\s*console\.log\([^;]*\);\s*continue;\s*\}/.test(script) &&
      firstSend > guard &&
      firstRecord > guard,
    'Every send and every activity_log write must sit behind the `if (!apply) continue` guard.',
  );
  check(
    'the sending script skips a job already asked for its current expiry',
    script.includes('alreadySent.get(job.id)?.has(job.expiresAt.toISOString())') &&
      script.indexOf('alreadySent.get(job.id)') < firstSend,
  );
  check(
    '--apply refuses to send on a configuration problem',
    /if \(apply && \(problems\.length > 0 \|\| !key\)\) \{[^}]*process\.exit\(1\)/.test(script),
  );
}

console.log(failures === 0 ? '\nAll listing-confirmation checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
