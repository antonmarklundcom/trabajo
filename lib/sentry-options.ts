// The Sentry options every runtime shares (PLAN-NEXT.md §3 O1).
//
// One object because the scrubbing below has to be true on the server, on the
// edge and in the browser, and three copies of a redaction rule is three
// chances for one of them to be the stale one.
//
// This file is imported by instrumentation*.ts, which run before the app does,
// so it must not import anything server-only.
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

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
 *   - **Query strings.** `/postulante/recuperar/confirmar?token=…` is a live
 *     password-reset token, and `?q=…` is what somebody searched for. A URL is
 *     not a safe field just because it is short.
 *   - **Cookies and auth headers**, which are session credentials.
 */
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  delete event.user;

  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;

    if (typeof event.request.url === 'string') {
      const [path] = event.request.url.split('?');
      event.request.url = path;
    }

    if (event.request.headers) {
      for (const header of ['cookie', 'authorization', 'x-forwarded-for', 'x-real-ip']) {
        delete event.request.headers[header];
      }
    }
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
