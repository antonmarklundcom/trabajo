/**
 * Client-side field checks for LeadForm, EmployerForm and ContactForm.
 *
 * The rules mirror the zod schemas in lib/leads.ts, which stays the
 * authority — a client check exists only to give the visitor inline
 * feedback before the round trip, never to replace server validation.
 * Kept separate from zod to avoid shipping the library (and its ~60KB
 * gzipped chunk, shared by every page that imports one of these forms)
 * to the browser for three schemas of five fields each.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional on every form that uses it — an empty value is valid. */
export function validateEmail(value: string): string | undefined {
  if (!value) return undefined;
  return EMAIL_RE.test(value) ? undefined : 'Email inválido';
}

export function validateMinLength(
  value: string,
  min: number,
  message: string,
): string | undefined {
  return value.trim().length >= min ? undefined : message;
}
