// The single place this app decides what a request's client IP is.
//
// Before this module there were seven copies of the same three lines, all of
// them wrong in the same way: they read the **leftmost** `x-forwarded-for`
// entry. XFF is append-only and client-writable — the proxy in front of us
// appends what it sees and forwards whatever the client already put there. So
// the leftmost entry is the one value in the chain that an attacker fully
// controls. Two consequences, and neither is visible in any UI:
//
//   1. Rate limiting keyed on it does not limit. `XFF: <random>` on every
//      request produces a fresh bucket every time, i.e. unlimited login
//      attempts against one account (PLAN-PHASE3-DRAFT.md §12.1).
//   2. `consents.ip` and `data_access_logs.ip` are ARCO evidence rows. An
//      attacker-chosen string in an evidence column is worse than an empty
//      one, because it looks like evidence (§13.3).
//
// The trusted value is counted from the RIGHT instead: our own proxy appends
// last, so with one proxy in front of the app the last entry is the peer it
// actually accepted the connection from. How many hops to skip is configuration
// (`TRUSTED_PROXY_HOPS`), not a guess — it is a property of the deployment, and
// the failure mode of guessing it is silent.
import 'server-only';

/**
 * Number of reverse proxies between the public internet and this process.
 *
 * 1 is correct for the deployment this repo targets: Hostinger's managed Node
 * hosting puts a single proxy in front of the app (DEPLOY.md). Put a CDN in
 * front of that and it becomes 2. Set it wrong high and you trust a
 * client-supplied entry; set it wrong low and everyone shares one bucket — so
 * the value is read once here and nowhere else.
 */
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number.parseInt(raw, 10);
  // A zero or negative value would mean "trust the client's own first entry",
  // which is the bug this module exists to remove. Garbage falls back rather
  // than throwing: a mistyped env var must not take the site down.
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TRUSTED_PROXY_HOPS;
  return parsed;
}

// Deliberately shape-checking rather than fully validating. The point is to
// reject junk an attacker stuffed into the header before it reaches an evidence
// column or a limiter key, not to be a conformant IP parser: a value that looks
// like an address but isn't routable is still a usable bucket key, whereas
// `<script>` or a 4KB string is not.
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

function looksLikeIp(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  // IPv6, optionally bracketed and/or with a port, as some proxies emit.
  const bare = value.startsWith('[') ? value.slice(1, value.indexOf(']')) : value;
  return bare.includes(':') && IPV6.test(bare);
}

/**
 * The client IP we are willing to believe, or `null` when there isn't one.
 *
 * Null is a real answer and callers must handle it: it means the request did
 * not arrive through the expected proxy chain (a direct hit on the origin, a
 * misconfigured `TRUSTED_PROXY_HOPS`, or a stripped header). Recording null in
 * an evidence column is honest; recording an attacker's string is not.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');

  if (forwarded) {
    const entries = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    // Our proxy appended the last entry. With `hops` proxies in front of us,
    // the client is `hops` positions from the right — entries to the LEFT of
    // that are whatever the client chose to send and are never read.
    const index = entries.length - trustedProxyHops();
    const candidate = index >= 0 ? entries[index] : undefined;

    if (candidate && looksLikeIp(candidate)) return candidate;

    // Shorter chain than configured: the request did not traverse the proxies
    // we expect. Fall through rather than reaching left for a spoofable entry.
  }

  // Set by the proxy itself and not forwarded from the client, so it is
  // trustworthy where it exists at all.
  const real = headers.get('x-real-ip')?.trim();
  if (real && looksLikeIp(real)) return real;

  return null;
}

/**
 * The same value as a non-null string, for rate-limiter keys.
 *
 * Unidentifiable requests deliberately share the single `unknown` bucket: they
 * are throttled together rather than each getting a free one, which is the
 * conservative direction for a limiter (the opposite of what an evidence column
 * wants, hence two functions).
 */
export function clientIpOrUnknown(headers: Headers): string {
  return clientIp(headers) ?? 'unknown';
}
