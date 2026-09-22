// POST /api/empresa/recuperar — ask for an employer password reset link.
//
// The employer twin of /api/postulante/recuperar, and built on the same rule:
// the response is identical whether or not the address has an account, so the
// form cannot be used to test which companies are registered. The work (issue
// token, send mail) happens only for a real, active employer; the body, the
// status and the rate-limit accounting are the same either way.
import { z } from 'zod';

import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';
import { checkEmployerResetRateLimit, recordEmployerResetRequest } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { findActiveEmployerByEmail } from '@/lib/db/employer-password';
import { issueUserToken, PASSWORD_RESET_TTL_MS } from '@/lib/db/user-tokens';
import { sendEmail } from '@/lib/email';
import { employerPasswordResetMessage } from '@/lib/emails/employer';

const schema = z.object({ email: z.string().min(1).email() });

const ACCEPTED = {
  ok: true,
  message: 'Si esa dirección tiene una cuenta, te enviamos un enlace para restablecer la contraseña.',
};

export async function POST(request: Request) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Escribí una dirección de email válida.' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = clientIpOrUnknown(request.headers);

  const rateLimit = checkEmployerResetRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
      },
      { status: 429 },
    );
  }
  // Counted on every request, hit or miss, so the limiter cannot leak which
  // addresses exist.
  recordEmployerResetRequest(ip, email);

  const employer = await findActiveEmployerByEmail(email);

  // One row per request, hit or miss, for the same reason as the candidate
  // side: a row only on a hit would make the table itself an oracle.
  await recordAuthEvent({
    surface: 'empresa',
    event: 'password_reset_request',
    userId: employer?.id ?? null,
    identifier: email,
    ip: clientIp(request.headers),
  });

  if (employer) {
    const token = await issueUserToken(employer.id, 'password_reset', PASSWORD_RESET_TTL_MS);
    await sendEmail(employerPasswordResetMessage(employer.email, employer.name, token));
  }

  return Response.json(ACCEPTED);
}
