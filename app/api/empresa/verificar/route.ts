// POST /api/empresa/verificar — redeem an employer email-verification token.
//
// The /empresa counterpart of /api/postulante/verificar, and it makes the same
// promise: verification gates NOTHING. An employer with an unconfirmed address
// logs in, edits their company profile and submits postings exactly like a
// confirmed one — because those postings land `pending` either way, and the
// /admin moderation queue is the gate that actually matters. Turning this into
// a gate later is a product decision, not something to smuggle in here.
//
// No session required: whoever holds the raw token received the email, which
// is the whole proof this endpoint exists to collect. Redemption is
// single-use, expiring and race-guarded in lib/db/user-tokens.ts.
import { z } from 'zod';

import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import { redeemUserToken } from '@/lib/db/user-tokens';
import { markUserEmailVerified } from '@/lib/db/employer-signup';

const schema = z.object({ token: z.string().min(1) });

const LINK_ERRORS: Record<string, string> = {
  invalid: 'Este enlace no es válido.',
  expired: 'Este enlace venció. Ingresá a tu cuenta para pedir uno nuevo.',
  used: 'Este email ya fue confirmado.',
};

export async function POST(request: Request) {
  if (!employerDashboardEnabled() || !employerSignupEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: LINK_ERRORS.invalid }, { status: 400 });
  }

  const redeemed = await redeemUserToken(parsed.data.token, 'email_verification');
  if (!redeemed.ok) {
    return Response.json({ error: LINK_ERRORS[redeemed.reason] }, { status: 410 });
  }

  await markUserEmailVerified(redeemed.userId);
  return Response.json({ ok: true });
}
