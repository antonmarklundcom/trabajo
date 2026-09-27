// POST /api/alertas/confirmar — the double opt-in's second half.
//
// POST only. The link in the email opens app/alertas/confirmar, a page that
// renders a button and writes nothing: mail clients and security scanners
// prefetch links, and a GET that confirmed would let a scanner opt a stranger
// in. No GET is exported here, so this URL answers a prefetch with a 405.
import { z } from 'zod';

import { jobAlertsEnabled } from '@/lib/flags';
import { isWellFormedJobAlertToken } from '@/lib/job-alert-token';
import { confirmJobAlert } from '@/lib/db/job-alerts';

const schema = z.object({ token: z.string() });

const INVALID = 'Este enlace no es válido o la alerta ya fue dada de baja.';

export async function POST(request: Request) {
  // Gated like the subscribe: with the feature off, nothing new starts
  // sending. (Unsubscribe is never gated — see lib/flags.ts.)
  if (!jobAlertsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isWellFormedJobAlertToken(parsed.data.token)) {
    return Response.json({ error: INVALID }, { status: 400 });
  }

  const result = await confirmJobAlert(parsed.data.token);
  if (!result.ok) return Response.json({ error: INVALID }, { status: 410 });

  return Response.json({ ok: true, already: result.already });
}
