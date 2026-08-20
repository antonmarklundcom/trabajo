// Server and edge instrumentation (node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/instrumentation.md).
//
// `register()` runs once per server instance before the first request;
// `onRequestError` is Next's hook for errors it catches during rendering and
// in route handlers, which is how an error that never reaches one of our own
// catch blocks still gets reported.
//
// Both are inert without NEXT_PUBLIC_SENTRY_DSN. CI builds with no DSN, and a
// build that required one would make error tracking a deploy blocker rather
// than an aid.
import type { Instrumentation } from 'next';

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const Sentry = await import('@sentry/nextjs');
  const { sharedSentryOptions } = await import('./lib/sentry-options');

  // Same options either side; the runtime difference is which SDK build the
  // import resolves to, which Next handles.
  Sentry.init(sharedSentryOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
};
