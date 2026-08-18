import { z } from 'zod';
import {
  authenticate,
  checkLoginRateLimit,
  clearLoginAttempts,
  createSession,
  homePathForRole,
  recordFailedLogin,
} from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Email o contraseña inválidos.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(request.headers);

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
  // The client navigates to redirectTo rather than to a hardcoded '/admin':
  // employers share this table and this cookie but not the admin route tree,
  // and sending one to /admin would bounce straight back out (PLAN-PHASE2.md
  // §2.1). The server decides the destination because the server is the only
  // side that knows the role.
  return Response.json({ ok: true, redirectTo: homePathForRole(user.role) });
}
