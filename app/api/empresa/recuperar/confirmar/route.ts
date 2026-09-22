// POST /api/empresa/recuperar/confirmar — redeem an employer reset token and
// set a new password. Twin of /api/postulante/recuperar/confirmar: specific
// about why a link failed (the caller holds a token only the inbox could have
// given them), and signs the employer in afterwards.
import { z } from 'zod';

import { createSession, hashPassword } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { redeemUserToken } from '@/lib/db/user-tokens';
import { setEmployerPassword } from '@/lib/db/employer-password';
import { clientIp } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';

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
  if (!employerDashboardEnabled()) {
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

  const redeemed = await redeemUserToken(parsed.data.token, 'password_reset');
  if (!redeemed.ok) {
    return Response.json({ error: LINK_ERRORS[redeemed.reason] }, { status: 410 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  // False when the account is no longer an active employer (deactivated, or a
  // staff account a token could never have been issued for): the link is
  // spent either way, and nothing is changed.
  const updated = await setEmployerPassword(redeemed.userId, passwordHash);
  if (!updated) {
    return Response.json({ error: LINK_ERRORS.invalid }, { status: 410 });
  }

  await recordAuthEvent({
    surface: 'empresa',
    event: 'password_reset_ok',
    userId: redeemed.userId,
    ip: clientIp(request.headers),
  });

  await createSession(redeemed.userId);
  return Response.json({ ok: true, redirectTo: '/empresa' });
}
