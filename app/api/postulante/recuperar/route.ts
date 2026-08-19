// POST /api/postulante/recuperar — ask for a password reset link
// (PLAN-NEXT.md §2 E1).
//
// The whole endpoint is built around one rule: the response must be identical
// whether or not the address has an account. A "no existe esa cuenta" here
// turns the form into a membership oracle — anyone could test a list of emails
// against a job board and learn who is looking for work, which is exactly the
// inference /privacidad exists to prevent.
//
// That rule shapes more than the message. The work (issue token, send mail)
// happens only for a real account, but the endpoint returns the same body and
// the same status either way, and the rate limiter is keyed on the submitted
// address so probing is bounded whether or not it hits.
import { z } from 'zod';

import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';
import {
  checkCandidateResetRateLimit,
  recordCandidateResetRequest,
} from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { findActiveCandidateByEmail } from '@/lib/db/candidate-profile';
import { issueCandidateToken, PASSWORD_RESET_TTL_MS } from '@/lib/db/candidate-tokens';
import { sendEmail } from '@/lib/email';
import { passwordResetMessage } from '@/lib/emails/candidate';

const schema = z.object({ email: z.string().min(1).email() });

// One body, always.
const ACCEPTED = {
  ok: true,
  message: 'Si esa dirección tiene una cuenta, te enviamos un enlace para restablecer la contraseña.',
};

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  // A malformed address cannot belong to an account, so this is not an oracle:
  // it says the input was not an email, not whether an email is registered.
  if (!parsed.success) {
    return Response.json({ error: 'Escribí una dirección de email válida.' }, { status: 400 });
  }

  const { email } = parsed.data;
  const ip = clientIpOrUnknown(request.headers);

  const rateLimit = checkCandidateResetRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
      },
      { status: 429 },
    );
  }
  // Counted on every request, not only the ones that find an account —
  // otherwise the limiter's own behaviour would leak which addresses exist.
  recordCandidateResetRequest(ip, email);

  const trustedIp = clientIp(request.headers);
  const candidate = await findActiveCandidateByEmail(email);

  // Logged for every request, hit or miss — a row only when an account was
  // found would make the TABLE an enumeration oracle for anyone who can read
  // it, which is the same leak the response body is careful to avoid.
  await recordAuthEvent({
    surface: 'postulante',
    event: 'password_reset_request',
    candidateId: candidate?.id ?? null,
    identifier: email,
    ip: trustedIp,
  });

  if (candidate) {
    const token = await issueCandidateToken(candidate.id, 'password_reset', PASSWORD_RESET_TTL_MS);
    // Not awaited for its result: a provider outage must not change what this
    // endpoint says, and sendEmail() never throws.
    await sendEmail(passwordResetMessage(candidate.email, candidate.name, token));
  }

  return Response.json(ACCEPTED);
}
