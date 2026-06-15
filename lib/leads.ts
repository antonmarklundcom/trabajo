/**
 * Lead orchestrator — handles both job applications (seekers) and employer
 * post requests. Every accepted submission is normalised into ONE flat,
 * snake_case JSON payload and fanned out to the configured destinations:
 *
 *   1. GHL inbound webhook   → process.env.GHL_WEBHOOK_URL
 *   2. Google Sheets webhook → process.env.GOOGLE_SHEETS_WEBHOOK_URL
 *
 * Both form types go to the SAME GHL inbound webhook; they are told apart by
 * the `type` and `lead_type` fields in the payload.
 *
 * Guarantees:
 *   - Fan-out runs in parallel via Promise.allSettled with 3× exponential
 *     backoff retries per destination.
 *   - A logger failure NEVER fails the user's submission (the caller schedules
 *     this after the response is sent and we swallow every rejection here).
 *   - If a destination's env var is empty it is skipped silently — the site
 *     keeps working with zero loggers configured (WhatsApp stays the primary
 *     channel).
 *   - Nothing sensitive is ever returned to / logged on the client.
 */

import { z } from 'zod';
import { cityLabel, categoryLabel } from './labels';

// ---------------------------------------------------------------------------
// Zod schemas (input contract — what the API route accepts)
// ---------------------------------------------------------------------------
//
// `name`/`phone` are OPTIONAL on applications so the leave-page WhatsApp beacon
// (which only knows the job, not the visitor's details) still validates and is
// recorded as a click. The interactive apply form enforces them client-side.

export const applicationSchema = z.object({
  type: z.literal('application'),
  jobSlug: z.string().min(1),
  jobTitle: z.string().min(1),
  name: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
  // Optional job context so seeker leads can carry city / category / contract.
  citySlug: z.string().max(100).optional(),
  categorySlug: z.string().max(100).optional(),
  contractType: z.string().max(40).optional(),
  // Where the submission came from + which channel triggered it.
  sourcePage: z.string().max(300).optional(),
  channel: z.string().max(40).optional(),
});

export const employerPostSchema = z.object({
  type: z.literal('employer_post'),
  companyName: z.string().min(2).max(150),
  contactName: z.string().min(2).max(100),
  contactWhatsapp: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal('')),
  jobTitle: z.string().min(3).max(200),
  categorySlug: z.string().min(1),
  citySlug: z.string().min(1),
  contractType: z.string().max(40).optional(),
  description: z.string().min(20).max(3000),
  sourcePage: z.string().max(300).optional(),
});

export const leadSchema = z.discriminatedUnion('type', [
  applicationSchema,
  employerPostSchema,
]);

export type LeadInput = z.infer<typeof leadSchema>;

// ---------------------------------------------------------------------------
// Flat outbound payload (the EXACT snake_case keys GHL / Sheets map to)
// ---------------------------------------------------------------------------

export type LeadPayload = {
  lead_type: 'employer' | 'seeker';
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
  job_slug: string;
  city: string;
  category: string;
  contract_type: string;
  message: string;
  source_page: string;
  submitted_at: string;
};

/** Strip everything but digits and, where possible, express PY numbers in E.164. */
function normalizePhone(raw: string | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('595')) return digits; // already country-prefixed
  // Local Paraguayan format "09XX..." → country code 595 (drop the trunk 0).
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  return digits;
}

/**
 * Map a validated input lead onto the single flat payload. Keys are always
 * present (empty string when not applicable) so Google Sheets columns and GHL
 * field mappings stay stable across both lead types.
 */
export function buildPayload(lead: LeadInput): LeadPayload {
  const base = {
    company_name: '',
    job_title: '',
    job_slug: '',
    city: '',
    category: '',
    contract_type: '',
    message: '',
    source_page: lead.sourcePage ?? '',
    submitted_at: new Date().toISOString(),
  };

  if (lead.type === 'employer_post') {
    return {
      ...base,
      lead_type: 'employer',
      full_name: lead.contactName,
      email: lead.email ?? '',
      phone: normalizePhone(lead.contactWhatsapp),
      company_name: lead.companyName,
      job_title: lead.jobTitle,
      city: cityLabel(lead.citySlug),
      category: categoryLabel(lead.categorySlug),
      contract_type: lead.contractType ?? '',
      message: lead.description,
    };
  }

  // application → seeker
  return {
    ...base,
    lead_type: 'seeker',
    full_name: lead.name ?? '',
    email: lead.email ?? '',
    phone: normalizePhone(lead.phone),
    job_title: lead.jobTitle,
    job_slug: lead.jobSlug,
    city: lead.citySlug ? cityLabel(lead.citySlug) : '',
    category: lead.categorySlug ? categoryLabel(lead.categorySlug) : '',
    contract_type: lead.contractType ?? '',
    message: lead.message ?? '',
  };
}

// ---------------------------------------------------------------------------
// HTTP delivery with exponential-backoff retries
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3; // 1 initial attempt + 3 retries
const REQUEST_TIMEOUT_MS = 10_000;

async function postWithRetry(url: string, payload: LeadPayload): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        // 1s, 2s, 4s exponential backoff between retries.
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw lastError;
}

/**
 * Deliver to a single destination. Empty env var → resolved no-op (graceful
 * degradation). The destination name is used only for server-side logging.
 */
async function deliver(
  name: string,
  url: string | undefined,
  payload: LeadPayload,
): Promise<void> {
  if (!url) return; // not configured → skip silently
  try {
    await postWithRetry(url, payload);
  } catch (err) {
    // Re-throw so allSettled records it; message only, no payload (no PII).
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new Error(`${name}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Fan the lead out to every configured destination in parallel. Never throws —
 * a logger failure must never bubble up to the user-facing request. Intended to
 * be scheduled via `after()` so it runs once the response has been sent.
 */
export async function processLead(lead: LeadInput): Promise<void> {
  const payload = buildPayload(lead);

  const results = await Promise.allSettled([
    deliver('ghl', process.env.GHL_WEBHOOK_URL, payload),
    deliver('sheets', process.env.GOOGLE_SHEETS_WEBHOOK_URL, payload),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      // Server-side observability only; never surfaced to the client.
      console.error('[leads] delivery failed —', result.reason);
    }
  }
}
