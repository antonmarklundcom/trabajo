import { z } from 'zod';
import {
  authenticateCandidate,
  checkCandidateLoginRateLimit,
  clearCandidateLoginAttempts,
  createCandidateSession,
  recordFailedCandidateLogin,
} from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Email o contraseña inválidos.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(request);

  const rateLimit = checkCandidateLoginRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
      },
      { status: 429 },
    );
  }

  const candidate = await authenticateCandidate(email, password);
  if (!candidate) {
    recordFailedCandidateLogin(ip, email);
    return Response.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  clearCandidateLoginAttempts(ip, email);
  await createCandidateSession(candidate.id);
  return Response.json({ ok: true, redirectTo: '/postulante/perfil' });
}
