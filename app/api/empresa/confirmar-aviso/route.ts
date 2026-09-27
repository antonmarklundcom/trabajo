// POST /api/empresa/confirmar-aviso — redeem a "¿Tu aviso sigue abierto?" link
// (lib/listing-confirm.ts, scripts/listing-confirm.ts).
//
// No session. The signed token IS the authorization: it names one job and one
// of two answers, and only a holder of SESSION_SECRET can mint it. The page at
// /empresa/confirmar-aviso never calls this on load — mail scanners prefetch
// links, and a GET that renewed or closed a listing would let one answer for
// the employer. A person presses the button; that is this POST.
//
// Order of checks, each cheaper than the next: flag, rate limit, signature and
// age (pure), then the row. The row check is repeated inside the write's WHERE
// clause (lib/db/employer.ts), so the read here only chooses the message — a
// race between two clicks cannot act twice.
//
// It never publishes. Both writes require a job admin already published, and
// neither can move a listing into `published`.
import { z } from 'zod';

import { clientIpOrUnknown } from '@/lib/client-ip';
import { employerDashboardEnabled } from '@/lib/flags';
import { isListingConfirmLimited } from '@/lib/public-write-limiter';
import { sameExpiry, verifyListingConfirmToken } from '@/lib/listing-confirm';
import { findListingConfirmTarget } from '@/lib/db/listing-confirm';
import { closeEmployerListingFromEmail, renewEmployerListingFromEmail } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';

const schema = z.object({ token: z.string().min(1).max(200) });

const ERRORS = {
  invalid: 'Este enlace no es válido.',
  expired: 'Este enlace venció. Podés gestionar tus avisos desde tu panel.',
  used: 'Este enlace ya no está activo: el aviso ya se renovó, se cerró o cambió desde que te escribimos.',
} as const;

export async function POST(request: Request) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  if (isListingConfirmLimited(clientIpOrUnknown(request.headers))) {
    return Response.json({ error: 'Demasiadas solicitudes. Probá de nuevo más tarde.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: ERRORS.invalid }, { status: 400 });

  const verdict = verifyListingConfirmToken(parsed.data.token);
  if (!verdict.ok) return Response.json({ error: ERRORS[verdict.reason] }, { status: 410 });
  const { jobId, action, expiresAt } = verdict.payload;

  const job = await findListingConfirmTarget(jobId);
  if (!job) return Response.json({ error: ERRORS.invalid }, { status: 410 });
  if (job.status !== 'published' || !sameExpiry(job.expiresAt, expiresAt)) {
    return Response.json({ error: ERRORS.used }, { status: 410 });
  }

  if (action === 'open') {
    const renewed = await renewEmployerListingFromEmail(job.companyId, jobId, expiresAt);
    if (!renewed) return Response.json({ error: ERRORS.used }, { status: 410 });
    invalidatePublicContent();
    return Response.json({ ok: true, action, expiresAt: renewed.expiresAt.toISOString() });
  }

  const closed = await closeEmployerListingFromEmail(job.companyId, jobId, expiresAt);
  if (!closed) return Response.json({ error: ERRORS.used }, { status: 410 });
  invalidatePublicContent();
  return Response.json({ ok: true, action });
}
