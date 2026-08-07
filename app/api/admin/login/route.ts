import { z } from 'zod';
import {
  authenticate,
  checkLoginRateLimit,
  clearLoginAttempts,
  createSession,
  recordFailedLogin,
} from '@/lib/auth';

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

function clientIp(request: Request): string {
  // Hostinger sits behind a reverse proxy; x-forwarded-for is the real
  // client. Falls back to a constant so rate limiting still groups
  // unidentifiable requests together instead of throwing.
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Email o contraseña inválidos.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(request);

  const rateLimit = checkLoginRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
      },
      { status: 429 },
    );
  }

  const user = await authenticate(email, password);
  if (!user) {
    recordFailedLogin(ip, email);
    return Response.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  clearLoginAttempts(ip, email);
  await createSession(user.id);
  return Response.json({ ok: true });
}
