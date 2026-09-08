// Split out of lib/leads.ts (S6): this constant and guard are the only part
// of that module a CLIENT component needs, and lib/leads.ts imports zod at
// module scope — bundling it just for a hidden input's field name shipped a
// ~60KB gzipped chunk to every page with a lead form. This file has no
// server-only or zod dependency, so it is safe for a 'use client' import.

/**
 * Hidden form field name. Real users never see or fill it (CSS-hidden +
 * `tabIndex={-1}` + `autoComplete="off"` in the form components); a bot that
 * fills every field it can see trips it.
 */
export const HONEYPOT_FIELD = 'website_url';

export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
