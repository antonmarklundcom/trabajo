// npm run client-ip:verify — the properties PR B1 exists to create
// (PLAN-PHASE3-DRAFT.md §12.1 "spoofable rate-limit key", §13.4).
//
// Why this is a CI script and not a review checklist: the defect it guards
// against was invisible. Seven route handlers read `x-forwarded-for` and took
// the leftmost entry, every one of them with a comment explaining that
// Hostinger sits behind a proxy — the reasoning was right there and still
// pointed at the wrong end of the list. Nothing failed, no test went red, and
// the limiter's numbers looked exactly the same as if it worked.
//
// So the assertion is stated the way an attacker would state it: send a header
// and see whether you got a new bucket.
//
// Pure functions, no database, no Next runtime — same arrangement as
// verify-retention.ts, and the reason lib/client-ip.ts does not import
// 'server-only'.
import { clientIp, clientIpForAudit, UNKNOWN_IP } from '../lib/client-ip';
import { createAttemptLimiter } from '../lib/rate-limit';

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failures += 1;
  }
}

function headers(xff?: string): Headers {
  const h = new Headers();
  if (xff !== undefined) h.set('x-forwarded-for', xff);
  return h;
}

console.log('\nclient IP — the trusted hop');

// The headline property. With one trusted proxy the real client is the entry
// the proxy appended, which is the LAST one; everything to its left is text the
// client chose.
check(
  'takes the proxy-appended entry, not the client-supplied one',
  clientIp(headers('1.2.3.4, 203.0.113.9')) === '203.0.113.9',
);
check(
  'a forged chain of any length does not change the answer',
  clientIp(headers('9.9.9.9, 8.8.8.8, 7.7.7.7, 203.0.113.9')) === '203.0.113.9',
);
check('a single entry is the proxy view', clientIp(headers('203.0.113.9')) === '203.0.113.9');

console.log('\nclient IP — nothing trustworthy');

check('no header at all', clientIp(headers()) === UNKNOWN_IP);
check('empty header', clientIp(headers('')) === UNKNOWN_IP);
check('junk at the trusted position', clientIp(headers('1.2.3.4, not-an-ip')) === UNKNOWN_IP);
check('an octet out of range', clientIp(headers('999.1.1.1')) === UNKNOWN_IP);
check(
  'x-real-ip is not consulted — it carries no position',
  (() => {
    const h = new Headers();
    h.set('x-real-ip', '203.0.113.9');
    return clientIp(h) === UNKNOWN_IP;
  })(),
);

console.log('\nclient IP — shapes that must survive');

check('IPv6', clientIp(headers('2001:db8::1')) === '2001:db8::1');
check('IPv6 bracketed with a port', clientIp(headers('[2001:db8::1]:443')) === '2001:db8::1');
check('IPv4 with a port', clientIp(headers('203.0.113.9:51234')) === '203.0.113.9');
check('surrounding whitespace', clientIp(headers('  1.2.3.4 ,  203.0.113.9  ')) === '203.0.113.9');

console.log('\naudit form — NULL is not the string "unknown"');

// consents.ip and data_access_logs.ip are evidence rows. 'unknown' would be a
// claim; NULL is the truth (lib/client-ip.ts).
check('known address is recorded', clientIpForAudit(headers('203.0.113.9')) === '203.0.113.9');
check('unknown address is NULL', clientIpForAudit(headers()) === null);
check('junk is NULL, never the junk itself', clientIpForAudit(headers('<script>')) === null);

console.log('\nthe limiter actually binds');

// The end-to-end statement of the bug: rotate the client-controlled part of the
// header and see whether the budget resets. Before B1 this loop never ran out.
{
  const limiter = createAttemptLimiter(5, 60_000);
  const email = 'admin@trabajo.com.py';
  let allowedAttempts = 0;

  for (let i = 0; i < 50; i += 1) {
    const ip = clientIp(headers(`${i}.${i}.${i}.${i}, 203.0.113.9`));
    if (!limiter.check(ip, email).allowed) break;
    allowedAttempts += 1;
    limiter.recordFailure(ip, email);
  }

  check(
    `a forged-XFF attacker is stopped (got ${allowedAttempts} attempts, expected 5)`,
    allowedAttempts === 5,
  );
}

{
  // The half that pinning the hop does NOT fix: real addresses. The
  // identifier-only bucket is what bounds this, at 4x the per-IP allowance.
  const limiter = createAttemptLimiter(5, 60_000);
  const email = 'admin@trabajo.com.py';
  let allowedAttempts = 0;

  for (let i = 0; i < 200; i += 1) {
    const ip = `203.0.113.${i % 254}`;
    if (!limiter.check(ip, email).allowed) break;
    allowedAttempts += 1;
    limiter.recordFailure(ip, email);
  }

  check(
    `a distributed attacker is bounded per account (got ${allowedAttempts} attempts, expected 20)`,
    allowedAttempts === 20,
  );
}

{
  // …without turning into a lockout of everyone else. Two accounts, and one
  // being throttled must not throttle the other.
  const limiter = createAttemptLimiter(5, 60_000);
  for (let i = 0; i < 40; i += 1) limiter.recordFailure(`203.0.113.${i}`, 'victim@example.com');

  check('a throttled account does not throttle others', limiter.check('1.1.1.1', 'someone@example.com').allowed);
  check('the throttled account is in fact throttled', !limiter.check('1.1.1.1', 'victim@example.com').allowed);

  // A success clears both buckets, so an honest user is never left stuck
  // behind their own earlier typos.
  limiter.clear('1.1.1.1', 'victim@example.com');
  check('a success clears the identity bucket too', limiter.check('2.2.2.2', 'victim@example.com').allowed);
}

{
  // The strict bucket's original promise, which B1 must not have traded away:
  // a stranger hammering a known address from elsewhere does not consume the
  // real user's own five attempts from their own address.
  const limiter = createAttemptLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) limiter.recordFailure('198.51.100.7', 'victim@example.com');

  check(
    'the attacker IP is throttled, the victim IP is not',
    !limiter.check('198.51.100.7', 'victim@example.com').allowed &&
      limiter.check('203.0.113.4', 'victim@example.com').allowed,
  );
}

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All client IP and rate limiter checks passed.');
