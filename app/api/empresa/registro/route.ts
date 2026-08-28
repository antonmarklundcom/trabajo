// POST /api/empresa/registro — self-serve employer signup (PLAN-PHASE2.md §8
// Q2, reopened by the owner 2026-08-28).
//
// What this handler deliberately does NOT accept: a company id, a role, or a
// job status. The account it creates is `employer` with a brand-new company
// (lib/db/employer-signup.ts explains why that is structural), and the
// postings it can then load go through createEmployerJob(), which hardcodes
// `pending`. There is no field on this request that can influence either.
import { z } from 'zod';

import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { createSession, hashPassword } from '@/lib/auth';
import { recordAuthEvent } from '@/lib/db/auth-events';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import { registerEmployer } from '@/lib/db/employer-signup';
import { issueUserToken, EMAIL_VERIFICATION_TTL_MS } from '@/lib/db/user-tokens';
import { isEmployerSignupLimited } from '@/lib/public-write-limiter';
import { sendEmail } from '@/lib/email';
import { employerVerificationMessage } from '@/lib/emails/employer';

const schema = z.object({
  companyName: z.string().min(2).max(255),
  name: z.string().min(2).max(200),
  email: z.string().min(1).email().max(320),
  password: z.string().min(8).max(200),
  whatsapp: z.string().max(20).nullable().optional(),
  termsAccepted: z.literal(true),
});

export async function POST(request: Request) {
  // Both flags, and in this order: while the dashboard is dark the whole
  // /empresa tree 404s, so an account created here would have nowhere to go.
  if (!employerDashboardEnabled() || !employerSignupEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const ip = clientIpOrUnknown(request.headers);
  if (isEmployerSignupLimited(ip)) {
    return Response.json(
      { error: 'Demasiadas solicitudes. Probá de nuevo más tarde.' },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const { companyName, name, email, password, whatsapp } = parsed.data;

  const passwordHash = await hashPassword(password);
  const trustedIp = clientIp(request.headers);

  const result = await registerEmployer({
    companyName,
    name,
    email,
    passwordHash,
    whatsapp: whatsapp?.trim() || null,
    ip: trustedIp,
    userAgent: request.headers.get('user-agent'),
  });

  if (!result.ok) {
    return Response.json(
      { error: 'Ya existe una cuenta con ese email. Probá ingresando.' },
      { status: 409 },
    );
  }

  // Best effort, exactly like the candidate registration path: sendEmail()
  // never throws and an unset RESEND_API_KEY is a logged skip, so a signup
  // cannot fail because the mail provider is not wired up. The account works
  // either way — verification gates nothing (lib/db/schema.ts).
  const token = await issueUserToken(result.userId, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
  await sendEmail(employerVerificationMessage(email, name, companyName, token));

  // Signing up IS this account's password being set for the first time, so it
  // belongs in the same trail as a later change — the same call
  // /api/empresa/activar makes for the invited equivalent.
  await recordAuthEvent({
    surface: 'empresa',
    event: 'password_change',
    userId: result.userId,
    ip: trustedIp,
  });

  await createSession(result.userId);
  return Response.json({ ok: true, redirectTo: '/empresa/perfil' }, { status: 201 });
}
