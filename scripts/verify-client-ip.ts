// Asserts the properties B1 exists to create (PLAN-PHASE3-DRAFT.md §12.1,
// §13.3). Every one of them is invisible when broken: a limiter keyed on a
// spoofable value still returns 429s, an evidence column still contains a
// string that looks like an address, and a shared limiter instance still
// limits. Nothing in a browser would show any of it, so it is asserted here
// and runs on every PR.
//
// No database, no network: lib/client-ip.ts is a pure function of headers and
// lib/rate-limit.ts is an in-memory map.
import { clientIp, clientIpOrUnknown } from '../lib/client-ip';
import { createAttemptLimiter, createRequestLimiter, LOGIN_LIMITS } from '../lib/rate-limit';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

console.log('\n— trusted hop —');

// THE original finding: the client prepends whatever it likes, the proxy
// appends the truth. Reading the left end hands the attacker the key.
check(
  'spoofed leftmost entry is ignored',
  clientIp(headers({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' })),
  '203.0.113.7',
);
check(
  'a whole forged chain is ignored',
  clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7' })),
  '203.0.113.7',
);
check(
  'no proxy header of their own: the single entry is the client',
  clientIp(headers({ 'x-forwarded-for': '203.0.113.7' })),
  '203.0.113.7',
);
check(
  'x-real-ip is used when there is no forwarded chain',
  clientIp(headers({ 'x-real-ip': '203.0.113.9' })),
  '203.0.113.9',
);
check('no headers at all yields null', clientIp(headers({})), null);
check('junk in the trusted position is rejected', clientIp(headers({ 'x-forwarded-for': '<script>' })), null);
check(
  'an oversized value is rejected',
  clientIp(headers({ 'x-forwarded-for': 'x'.repeat(4096) })),
  null,
);
check('IPv6 survives', clientIp(headers({ 'x-forwarded-for': '2001:db8::1' })), '2001:db8::1');
check(
  'an impossible dotted quad is rejected',
  clientIp(headers({ 'x-forwarded-for': '999.1.1.1' })),
  null,
);

// Limiter keys must never be null, and unidentifiable requests share one
// bucket rather than each getting a free one.
check('limiter key falls back to a shared bucket', clientIpOrUnknown(headers({})), 'unknown');

console.log('\n— limiter counters are not shared —');

// §13.3: the ARCO deletion path used the LOGIN limiter instance, so five
// mistyped confirmations locked the account out of logging in.
const login = createAttemptLimiter(LOGIN_LIMITS);
const deletion = createAttemptLimiter(LOGIN_LIMITS);
for (let i = 0; i < LOGIN_LIMITS.maxAttempts; i += 1) {
  deletion.recordFailure('203.0.113.7', 'a@example.com');
}
check('deletion budget is spent', deletion.check('203.0.113.7', 'a@example.com').allowed, false);
check('login budget is untouched', login.check('203.0.113.7', 'a@example.com').allowed, true);

console.log('\n— the identity bucket —');

// Pinning the hop stops one attacker forging many origins. It does nothing
// about an attacker who genuinely has many, which is what this bucket is for.
const distributed = createAttemptLimiter(LOGIN_LIMITS);
for (let i = 0; i < LOGIN_LIMITS.maxPerIdentity; i += 1) {
  distributed.recordFailure(`198.51.100.${i}`, 'victim@example.com');
}
check(
  'a fresh origin is refused once the identity budget is gone',
  distributed.check('198.51.100.250', 'victim@example.com').allowed,
  false,
);
check(
  'a different account from the same origins is unaffected',
  distributed.check('198.51.100.250', 'someone-else@example.com').allowed,
  true,
);

// The per-origin bucket stays the primary one precisely so a stranger cannot
// cheaply lock a known-good account out of one location.
const perOrigin = createAttemptLimiter(LOGIN_LIMITS);
for (let i = 0; i < LOGIN_LIMITS.maxAttempts; i += 1) {
  perOrigin.recordFailure('203.0.113.1', 'victim@example.com');
}
check(
  'attacker origin is blocked',
  perOrigin.check('203.0.113.1', 'victim@example.com').allowed,
  false,
);
check(
  'the real user elsewhere still gets in',
  perOrigin.check('198.51.100.2', 'victim@example.com').allowed,
  true,
);

console.log('\n— request limiter —');

const flood = createRequestLimiter(5, 60_000);
for (let i = 0; i < 5; i += 1) flood.isLimited('203.0.113.7');
check('sixth request in the window is limited', flood.isLimited('203.0.113.7'), true);
check('a different origin is not', flood.isLimited('198.51.100.4'), false);

// B5: the two authenticated candidate write endpoints get their own instances,
// for the same reason login and deletion do above. Saving a job is a cheap
// toggle a browsing candidate hits often; applying is rare and irreversible.
// Sharing one counter would let a save loop spend the applying budget, and
// nothing about that is visible from a browser.
console.log('\n— candidate write limiters —');

const saves = createRequestLimiter(30, 60_000);
const applications = createRequestLimiter(10, 60_000);
for (let i = 0; i < 30; i += 1) saves.isLimited('203.0.113.7:42');
check('the save budget is spent', saves.isLimited('203.0.113.7:42'), true);
check('the application budget is untouched', applications.isLimited('203.0.113.7:42'), false);
check(
  'a second candidate on the same IP has its own budget',
  saves.isLimited('203.0.113.7:43'),
  false,
);

console.log(failures === 0 ? '\nAll client-IP and limiter properties hold.\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
