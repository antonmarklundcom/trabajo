// What Google Analytics is allowed to learn about the URL a visitor is on.
//
// The problem this exists for: GA stores the full `page_location` of every hit
// it receives, and several pages on this site carry a live secret in their
// query string — `/postulante/verificar?token=…`,
// `/postulante/recuperar/confirmar?token=…`, `/empresa/verificar?token=…`,
// `/empresa/recuperar/confirmar?token=…` and `/empresa/activar?token=…` (an
// admin-issued invitation). A reset token sitting in a third party's event
// store is a working password-reset link for anyone who can read that store,
// for as long as it has not been redeemed. lib/sentry-options.ts solves the
// same problem for error reports; this is its analytics half.
//
// The rule is an allowlist in BOTH dimensions, because a denylist ("strip
// `token`") fails open the day someone adds `?code=` or `?invite=`:
//
//   - Paths: only public pages are measured at all. Anything under an account
//     prefix gets no page_view and has GA switched off while it is open.
//   - Query parameters: only the public listing filters, pagination and the
//     utm_* campaign tags survive. Everything else is dropped, whatever it is
//     called.
//
// Pure functions, no DOM and no 'use client', so scripts/verify-analytics.ts
// can import and exercise them directly.

/**
 * Route trees that belong to a signed-in (or signing-in) account. No page_view
 * is ever sent from these, and GA is disabled while one is open, so even an
 * automatic enhanced-measurement hit configured in the GA admin cannot fire
 * there. `/api` is here for completeness — a route handler never renders the
 * component — so that the list reads as "everything that is not a public
 * page" rather than as a list of the pages we happened to think of.
 */
export const ACCOUNT_PATH_PREFIXES = ['/admin', '/empresa', '/postulante', '/api'] as const;

/**
 * The query parameters that may reach GA. The listing filters are the real
 * names app/empleos/page.tsx reads (listingParams()); utm_* are what GA's own
 * campaign attribution reads from page_location, and carry nothing but the
 * campaign a link was tagged with. Nothing else passes — in particular never
 * `token`, which is the reason this list exists.
 */
export const ALLOWED_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'q',
  'categoria',
  'ciudad',
  'tipo',
  'nivel',
  'modalidad',
  'salario_min',
  'orden',
  'page',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]);

/** True for a public page GA may measure; false for any account area. */
export function isTrackablePath(pathname: string): boolean {
  return !ACCOUNT_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * origin + pathname + only the allowlisted query parameters, in their original
 * order. The fragment is always dropped. For an account-area path the query
 * string is dropped entirely, allowlisted or not: nothing from those pages'
 * query strings is ever worth measuring, and it keeps the answer for them
 * independent of what the allowlist grows to include.
 */
export function sanitizePageLocation(origin: string, pathname: string, search: string): string {
  if (!isTrackablePath(pathname)) return `${origin}${pathname}`;
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (ALLOWED_QUERY_PARAMS.has(key)) kept.append(key, value);
  }
  const query = kept.toString();
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

/**
 * The referrer GA may see. Same-origin: sanitized exactly like a location, so
 * arriving at a public page from a token page does not smuggle the token in
 * through page_referrer. Cross-origin: the origin only — which site sent the
 * visitor is what attribution needs, and another site's full URL can carry
 * its own secrets. Unparseable or empty: empty.
 */
export function sanitizeReferrer(referrer: string, origin: string): string {
  if (!referrer) return '';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return '';
  }
  if (url.origin === origin) return sanitizePageLocation(url.origin, url.pathname, url.search);
  return `${url.origin}/`;
}
