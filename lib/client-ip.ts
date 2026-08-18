// The one place an HTTP request becomes a client IP.
//
// PLAN-PHASE3-DRAFT.md §12.1 (spoofable rate-limit key) and §13.4 PR B1. Before
// this module, seven call sites each read `x-forwarded-for` and took the
// LEFTMOST entry. That entry is whatever the client sent: a proxy APPENDS its
// view of the peer, it does not replace what is already there. So a request
// arriving with `X-Forwarded-For: 1.2.3.4` reaches the app as
// `1.2.3.4, <real client>` — and reading the left end means reading the
// attacker's own string. Every bucket keyed on it was one header away from
// being a fresh bucket.
//
// The right end is the trustworthy one, counted inwards: with N proxies we
// control between the internet and this process, the Nth entry from the right
// is the address the outermost trusted proxy actually saw. N is configuration,
// not something to infer from the header — inferring it from the header is the
// same mistake in a different shape.
//
// No `server-only` import here on purpose: scripts/verify-client-ip.ts runs
// this under plain tsx, the same arrangement lib/cache-tags.ts uses and for the
// same reason. The module is pure — headers in, string out — which is what
// makes the property assertable in CI rather than at review time.

/**
 * How many proxies we control sit in front of this process.
 *
 * 1 on Hostinger today (DEPLOY.md): the platform's reverse proxy, and nothing
 * else. Put a CDN in front of it and this becomes 2 — and it must be raised in
 * the same change, because a stale value here reads one hop too far out, which
 * is back to reading client-supplied text.
 *
 * Deliberately not defaulting to 0: 0 would mean "trust no hop", which turns
 * every request into `UNKNOWN_IP` and collapses all rate limiting into one
 * global bucket. 1 is the true value for the deployment this repo targets.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * What a caller gets when the chain is shorter than it should be, the header
 * is missing, or the entry at the trusted position is not an IP at all.
 *
 * A constant, not a random value or the raw string: requests we cannot place
 * must share ONE bucket, so that "unidentifiable" can never be a way to mint
 * unlimited buckets. It is the same sentinel the old inline helpers used, kept
 * so the failure mode is familiar.
 */
export const UNKNOWN_IP = 'unknown';

// Deliberately narrow. The point is not to validate an address for correctness
// but to refuse anything that is not one: an unvalidated token becomes a Map
// key in the limiters, so accepting arbitrary text would let a caller grow
// those maps with garbage even after the hop counting is right.
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

function isIpAddress(value: string): boolean {
  const v4 = IPV4.exec(value);
  if (v4) return v4.slice(1).every((octet) => Number(octet) <= 255);
  // IPv6 needs at least one colon and no more than the 8 groups' worth of
  // separators; the shape check above bounds length, this rejects `::::::…`.
  if (!IPV6.test(value)) return false;
  return value.includes(':') && (value.match(/:/g)?.length ?? 0) <= 8;
}

/**
 * Ports, and only ports.
 *
 * `[2001:db8::1]:443` is the bracketed form and unambiguous. A bare IPv4 may
 * carry `:51234`. A bare IPv6 must be left alone — stripping a trailing
 * `:digits` from `2001:db8::1` would silently produce `2001:db8:` and hand back
 * UNKNOWN_IP for a perfectly good address, which is a failure that would have
 * looked like a proxy misconfiguration rather than a parsing bug.
 */
function stripPort(entry: string): string {
  if (entry.startsWith('[')) {
    const close = entry.indexOf(']');
    return close === -1 ? entry.slice(1) : entry.slice(1, close);
  }
  // Exactly one colon means host:port; more than one means IPv6, which never
  // carries a port unbracketed.
  const colons = entry.match(/:/g)?.length ?? 0;
  return colons === 1 ? entry.replace(/:\d+$/, '') : entry;
}

/**
 * The client IP as seen by the outermost proxy we control, or `UNKNOWN_IP`.
 *
 * Never returns a client-supplied value. `x-real-ip` is NOT consulted: it is
 * also just a header, it carries no position information, and trusting it
 * would reopen the hole this module exists to close.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return UNKNOWN_IP;

  const chain = forwarded
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const hops = trustedProxyHops();
  // chain[chain.length - hops]: with one trusted proxy, the last entry — the
  // one it appended itself. Shorter than `hops` means the request did not
  // traverse the chain we think it did, and there is no entry we are entitled
  // to believe.
  const candidate = chain[chain.length - hops];
  if (!candidate) return UNKNOWN_IP;

  return isIpAddress(stripPort(candidate)) ? stripPort(candidate) : UNKNOWN_IP;
}

/**
 * The same value, but `null` instead of a sentinel — for the columns that
 * RECORD an address rather than bucket on it (`consents.ip`,
 * `data_access_logs.ip`).
 *
 * Those rows are evidence: a consent record says who agreed, from where, at
 * what time. Writing the literal string 'unknown' into them would be a claim;
 * NULL is the truth, which is that we do not know. And now that the value is
 * no longer attacker-chosen, what those columns hold is worth something —
 * which is the other half of why this fix is not only about limiters.
 */
export function clientIpForAudit(headers: Headers): string | null {
  const ip = clientIp(headers);
  return ip === UNKNOWN_IP ? null : ip;
}
