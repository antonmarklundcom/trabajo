'use client';

/**
 * Thin GA4 event helper. No-ops when GA is not loaded (NEXT_PUBLIC_GA_ID
 * unset) so callers never need to guard.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params?: EventParams) {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event, params);
}
