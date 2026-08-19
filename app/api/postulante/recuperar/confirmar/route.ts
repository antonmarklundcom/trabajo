// POST /api/postulante/recuperar/confirmar — redeem a reset token and set a new
// password (PLAN-NEXT.md §2 E1).
//
// Unlike the request endpoint, this one may be specific about why a link did
// not work. The caller is holding a raw token, which they could only have got
// from the inbox — so "this link expired" leaks nothing they did not already
// know, and telling them is the difference between asking for a new link and
// concluding the site is broken.
import { z } from 'zod';

import { hashPassword, createCandidateSession } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { redeemCandidateToken } from '@/lib/db/candidate-tokens';
import { setCandidatePassword } from '@/lib/db/candidate-profile';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

const LINK_ERRORS: Record<string, string> = {
  invalid: 'Este enlace no es válido. Pedí uno nuevo.',
  expired: 'Este enlace venció. Pedí uno nuevo.',
  used: 'Este enlace ya fue utilizado. Pedí uno nuevo.',
};

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'La contraseña tiene que tener al menos 8 caracteres.' },
      { status: 400 },
    );
  }

  const redeemed = await redeemCandidateToken(parsed.data.token, 'password_reset');
  if (!redeemed.ok) {
    return Response.json({ error: LINK_ERRORS[redeemed.reason] }, { status: 410 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  // Also drops every other outstanding token for this account, including a
  // reset link an attacker may have requested minutes earlier.
  await setCandidatePassword(redeemed.candidateId, passwordHash);

  // Signing them in is the point of having proved control of the inbox; making
  // them retype the password they just chose would be theatre.
  await createCandidateSession(redeemed.candidateId);
  return Response.json({ ok: true, redirectTo: '/postulante/perfil' });
}
