import type { NextConfig } from 'next';

// Security headers (PLAN-NEXT.md §2, owner decision 4e). Three are enforced
// immediately because they cannot break a working page; the CSP is
// Report-Only, for the reason below.
//
// Why not an enforced CSP yet. A strict policy needs nonces, and in Next 16
// nonces come from a `proxy.ts` that must run per request — which forces
// DYNAMIC rendering on every page that carries one
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// This site is mostly static and SSG, and trading that away for a header is a
// real cost, not a formality. The brief anticipated exactly this: use nonces
// only if the Next 16 docs make it clean, otherwise start Report-Only and
// enforce once the console is clean on every route group.
//
// The policy below is deliberately the TARGET policy rather than a permissive
// one. It omits `'unsafe-inline'` for scripts, so the browser console will
// report every inline script that would break — which today is exactly two
// kinds, both known: the GA4 init snippet (components/Analytics.tsx) and the
// JSON-LD blocks on the six route groups that emit them. That report is the
// input to the follow-up PR that adds nonces or hashes; a policy that allowed
// inline scripts would report nothing and teach us nothing.
//
// Nothing here is enforced against script execution yet. That is the honest
// state, and it is why this rides along with B3 rather than being called done.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // GA4 loads gtag from googletagmanager. The inline init snippet is NOT
  // allowed on purpose — see above.
  "script-src 'self' https://www.googletagmanager.com",
  // Next injects inline styles; there is no styling equivalent of the nonce
  // problem worth solving first, and inline CSS is not an execution vector.
  "style-src 'self' 'unsafe-inline'",
  // Images are served from this origin (/img/[...key], PLAN-IMAGES.md §2.1);
  // data: and blob: cover Next's own placeholder handling. GA's tracking pixel
  // needs its two origins.
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "object-src 'none'",
  "base-uri 'self'",
  // The site posts only to itself: the lead API, /publicar, and the three login
  // surfaces.
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything. A security header that applies to some routes is a
        // security header someone will forget to extend to a new one.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
          {
            // Stops a browser from second-guessing a Content-Type. Matters most
            // on /img/[...key] and the three CV download routes, where the
            // bytes are user-supplied and the declared type is the only thing
            // saying they are not a document.
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // No page here is meant to be embedded. `frame-ancestors 'none'` in
            // the CSP says the same thing, but that CSP is Report-Only today,
            // so this is the header actually doing the work.
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Full URL to this origin, bare origin to anyone else. Job and
            // article URLs are public, but a candidate's session paths under
            // /postulante should not be handed to an external site in a
            // Referer.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

// Deliberately NOT set here: Strict-Transport-Security. The brief conditions it
// on verifying Hostinger is not already sending one, and a second, weaker HSTS
// header from the app would be worse than none. That verification needs a
// request to the live host, which this environment's network policy blocks —
// so it stays an owner check rather than a guess (see the PR body).

export default nextConfig;
