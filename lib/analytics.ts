'use client';

/**
 * Thin GA4 event helper. No-ops when GA is not loaded (NEXT_PUBLIC_GA_ID
 * unset) so callers never need to guard.
 *
 * Exactly two event names exist on this site (PLAN-GROWTH.md §1): a new CTA
 * reuses one of these, it does not invent a third. The overloads below are
 * what makes that a build-time property instead of a convention — an
 * untyped third event name fails `tsc`, and `scripts/verify-whatsapp.ts`
 * checks that no call site routes around the overloads with an `as` cast.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type WhatsAppClickEvent = {
  audience: 'employer' | 'seeker';
  intent: string;
  job_slug?: string;
  category?: string;
  city?: string;
  source_page: string;
};

export type LeadSubmitEvent = {
  lead_type: 'employer' | 'seeker' | 'contact';
  channel: 'form';
  job_slug?: string;
};

export function track(event: 'whatsapp_click', params: WhatsAppClickEvent): void;
export function track(event: 'lead_submit', params: LeadSubmitEvent): void;
export function track(
  event: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event, params);
}
