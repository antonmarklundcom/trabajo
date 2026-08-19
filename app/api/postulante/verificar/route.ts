// POST /api/postulante/verificar — redeem an email-verification token
// (PLAN-NEXT.md §2 E1).
//
// Verification gates nothing: an unverified account applies, uploads a CV and
// logs in exactly like a verified one. It exists so a consent row has an
// address someone proved they control behind it (§14 D2 point 4). Treating it
// as a gate later is a product decision, not something to smuggle in here.
import { z } from 'zod';

import { candidateAccountsEnabled } from '@/lib/flags';
import { redeemCandidateToken } from '@/lib/db/candidate-tokens';
import { markCandidateEmailVerified } from '@/lib/db/candidate-profile';

const schema = z.object({ token: z.string().min(1) });

const LINK_ERRORS: Record<string, string> = {
  invalid: 'Este enlace no es válido.',
  expired: 'Este enlace venció. Ingresá a tu cuenta para pedir uno nuevo.',
  used: 'Este email ya fue confirmado.',
};

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: LINK_ERRORS.invalid }, { status: 400 });
  }

  const redeemed = await redeemCandidateToken(parsed.data.token, 'email_verification');
  if (!redeemed.ok) {
    return Response.json({ error: LINK_ERRORS[redeemed.reason] }, { status: 410 });
  }

  await markCandidateEmailVerified(redeemed.candidateId);
  return Response.json({ ok: true });
}
