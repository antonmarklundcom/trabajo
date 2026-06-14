/**
 * Lead orchestrator — handles both job applications and employer post requests.
 * Fan-out: GHL webhook + Google Sheets, Promise.allSettled, 3× exponential backoff.
 * A logger failure NEVER fails the user's submission.
 */

import { z } from 'zod';
import type { Lead } from './types';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const applicationSchema = z.object({
  type: z.literal('application'),
  jobSlug: z.string().min(1),
  jobTitle: z.string().min(1),
  name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
});

export const employerPostSchema = z.object({
  type: z.literal('employer_post'),
  companyName: z.string().min(2).max(150),
  contactName: z.string().min(2).max(100),
  contactWhatsapp: z.string().min(6).max(20),
  email: z.string().email().optional().or(z.literal('')),
  jobTitle: z.string().min(3).max(200),
  categorySlug: z.string().min(1),
  citySlug: z.string().min(1),
  description: z.string().min(20).max(3000),
});

export const leadSchema = z.discriminatedUnion('type', [
  applicationSchema,
  employerPostSchema,
]);

export type LeadInput = z.infer<typeof leadSchema>;

// ---------------------------------------------------------------------------
// HTTP retry helper
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Logger implementations
// ---------------------------------------------------------------------------

async function logToGhl(lead: Lead): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) return; // graceful no-op if not configured
  await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, source: 'trabajo.com.py' }),
  });
}

async function logToSheets(lead: Lead): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return; // graceful no-op if not configured
  await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, source: 'trabajo.com.py', timestamp: new Date().toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

export async function processLead(lead: Lead): Promise<void> {
  // Fan-out to all loggers in parallel; failures are swallowed — the user
  // already received success by the time this runs in the background.
  const results = await Promise.allSettled([
    logToGhl(lead),
    logToSheets(lead),
  ]);

  // Log failures server-side for observability without surfacing to user
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[leads] Logger failed:', result.reason);
    }
  }
}
