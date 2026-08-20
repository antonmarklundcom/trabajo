// Browser instrumentation (node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/instrumentation-client.md). Runs before
// the app becomes interactive.
//
// Inert without NEXT_PUBLIC_SENTRY_DSN — which is also what keeps the SDK from
// opening a connection on a visitor's phone in a deploy that has no DSN.
import * as Sentry from '@sentry/nextjs';

import { sharedSentryOptions } from './lib/sentry-options';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...sharedSentryOptions,
    // No session replay. It records what a visitor typed, which on this site
    // includes a CV, a phone number and a password field.
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
