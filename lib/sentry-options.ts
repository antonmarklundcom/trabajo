// The Sentry options every runtime shares (PLAN-NEXT.md §3 O1).
//
// One object because the scrubbing below has to be true on the server, on the
// edge and in the browser, and three copies of a redaction rule is three
// chances for one of them to be the stale one.
//
// This file is imported by instrumentation*.ts, which run before the app does,
// so it must not import anything server-only.
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Request headers that carry a credential or an address, deleted by name.
 *
 * `referer` is the one that is easy to miss and the one that matters most here:
 * a browser sends the URL it navigated *from*, so a fetch fired on
 * `/postulante/recuperar/confirmar?token=…` arrives at the server carrying a
 * live password-reset token in a header — the same secret `query_string` is
 * deleted for, taking a different door.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'referer',
  'referrer',
  'forwarded',
  'x-forwarded-for',
  'x-real-ip',
  'x-api-key',
  'x-csrf-token',
]);

/** Breadcrumb fields that hold a URL, whichever integration produced them. */
const BREADCRUMB_URL_FIELDS = ['url', 'from', 'to'] as const;

/** Everything before the first `?` or `#`. */
function pathOnly(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Strips the query string from every URL a breadcrumb carries.
 *
 * Breadcrumbs are the leak `event.request` scrubbing does not cover, and the
 * gap is not theoretical: the browser SDK's default integrations record a
 * `navigation` crumb per route change (`data.from` / `data.to`, full URLs) and
 * a `fetch`/`xhr` crumb per request (`data.url`). This app has exactly two
 * pages whose secret lives in the query string — `/postulante/verificar?token=`
 * and `/postulante/recuperar/confirmar?token=` — so any error captured while a
 * visitor sat on one of them shipped a live token to Sentry inside the crumb
 * trail, with `event.request.query_string` dutifully deleted beside it.
 *
 * `console` crumbs are dropped whole rather than filtered. They hold whatever
 * was passed to `console.*`, already stringified, and this file's rule is
 * deletion over recognition: a scrubber that tries to spot a token inside a log
 * line will miss one. The exception and its stack are what debug an error; the
 * console trail is a convenience, and not one worth an ARCO incident.
 */
function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === 'console') return null;

  if (crumb.data) {
    for (const field of BREADCRUMB_URL_FIELDS) {
      const value = crumb.data[field];
      if (typeof value === 'string') crumb.data[field] = pathOnly(value);
    }
  }

  // `navigation` crumbs put the URLs in `message` too on some SDK versions.
  if (typeof crumb.message === 'string' && crumb.message.includes('?')) {
    crumb.message = crumb.message.replace(/\S*\?\S*/g, (match) => pathOnly(match));
  }

  return crumb;
}

/**
 * Strips everything that could carry personal data out of an event.
 *
 * The list is deliberately an allowlist-by-deletion rather than a filter on
 * suspicious-looking values: a scrubber that tries to recognise an email
 * address will miss one, and this app handles ARCO-regulated data where the
 * cost of missing one is not a bug report.
 *
 * Deleted:
 *   - **Request bodies.** Every mutating route in this app posts something
 *     personal: a name and phone on an application, a password on login, a CV
 *     upload's metadata.
 *   - **The user object.** Sentry would otherwise attach an id, an address or
 *     an IP; `sendDefaultPii: false` covers most of it and this covers the rest.
 *   - **Query strings**, in the request URL *and* in every breadcrumb that
 *     recorded one. `/postulante/recuperar/confirmar?token=…` is a live
 *     password-reset token, and `?q=…` is what somebody searched for. A URL is
 *     not a safe field just because it is short.
 *   - **Cookies, auth headers and `referer`**, which are session credentials or
 *     carry the query string the line above just removed.
 *   - **`extra`**, an untyped bag that any future `captureException` call can
 *     put anything into. Structured context belongs in tags.
 */
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  delete event.user;
  delete event.extra;

  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;

    if (typeof event.request.url === 'string') {
      event.request.url = pathOnly(event.request.url);
    }

    if (event.request.headers) {
      // Matched case-insensitively: HTTP header names are case-insensitive and
      // which casing reaches this function depends on which runtime captured
      // the event, so a fixed lowercase key list would silently miss `Referer`.
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) delete event.request.headers[name];
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }

  return event;
}

/**
 * Shared init options. The DSN is read by each runtime's own entry point.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` rather than a private variable: a DSN is a write-only
 * public identifier by design (it ships in every browser bundle that reports
 * errors), and one variable that the server, the edge and the client all read
 * cannot be half-configured.
 */
export const sharedSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No tracing. This is error tracking, and traces on the free tier's quota
  // would crowd out the errors it exists to keep.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  environment: process.env.NODE_ENV,
} as const;
