import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';
import { z } from 'zod';
import {
  authenticate,
  checkLoginRateLimit,
  clearLoginAttempts,
  createSession,
  homePathForRole,
  recordFailedLogin,
} from '@/lib/auth';

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
  const ip = clientIpOrUnknown(request.headers);

  const rateLimit = checkLoginRateLimit(ip, email);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
      },
      { status: 429 },
    );
  }

  const trustedIp = clientIp(request.headers);

  const user = await authenticate(email, password);
  if (!user) {
    recordFailedLogin(ip, email);
    // A failure has no established identity, so no userId — only a truncated
    // hint, which is enough to see one account being hammered.
    await recordAuthEvent({ surface: 'admin', event: 'login_fail', identifier: email, ip: trustedIp });
    return Response.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }

  clearLoginAttempts(ip, email);
  await recordAuthEvent({ surface: 'admin', event: 'login_ok', userId: user.id, ip: trustedIp });
  await createSession(user.id);
  // The client navigates to redirectTo rather than to a hardcoded '/admin':
  // employers share this table and this cookie but not the admin route tree,
  // and sending one to /admin would bounce straight back out (PLAN-PHASE2.md
  // §2.1). The server decides the destination because the server is the only
  // side that knows the role.
  return Response.json({ ok: true, redirectTo: homePathForRole(user.role) });
}
