// POST /api/postulante/registro — candidate signup + consent #1
// (PLAN-PHASE2.md §4.1). Blocking: no account is created without it.
import { clientIp } from '@/lib/client-ip';
import { z } from 'zod';
import { hashPassword, createCandidateSession } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { registerCandidate } from '@/lib/db/candidate-profile';
import {
  issueCandidateToken,
  EMAIL_VERIFICATION_TTL_MS,
} from '@/lib/db/candidate-tokens';
import { sendEmail } from '@/lib/email';
import { emailVerificationMessage } from '@/lib/emails/candidate';

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(8).max(200),
  name: z.string().min(2).max(200),
  phone: z.string().min(6).max(20),
  cityId: z.number().int().positive().nullable().optional(),
  consentAccepted: z.literal(true),
});

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const { email, password, name, phone, cityId } = parsed.data;

  const passwordHash = await hashPassword(password);
  const result = await registerCandidate({
    email,
    passwordHash,
    name,
    phone,
    cityId: cityId ?? null,
    ip: clientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  });

  if (!result.ok) {
    return Response.json({ error: 'Ya existe una cuenta con ese email.' }, { status: 409 });
  }

  // Verification email, best effort. sendEmail() never throws and an unset
  // RESEND_API_KEY is a logged skip, so a registration cannot fail because the
  // mail provider is not wired up — the account works either way
  // (PLAN-NEXT.md §2 E1).
  const token = await issueCandidateToken(
    result.candidateId,
    'email_verification',
    EMAIL_VERIFICATION_TTL_MS,
  );
  await sendEmail(emailVerificationMessage(email, name, token));

  await createCandidateSession(result.candidateId);
  return Response.json({ ok: true, redirectTo: '/postulante/perfil' }, { status: 201 });
}
