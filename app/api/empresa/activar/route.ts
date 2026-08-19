import { clientIp } from '@/lib/client-ip';
import { z } from 'zod';
import { createSession, hashPassword } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { acceptInvitation } from '@/lib/db/employer-invitations';

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(200),
  password: z.string().min(8).max(200),
  termsAccepted: z.literal(true),
});

export async function POST(request: Request) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const { token, name, password } = parsed.data;

  const passwordHash = await hashPassword(password);
  const userId = await acceptInvitation(token, {
    name,
    passwordHash,
    ip: clientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  });

  if (userId === null) {
    return Response.json(
      { error: 'Este enlace de invitación no es válido, ya venció o ya fue utilizado.' },
      { status: 410 },
    );
  }

  await createSession(userId);
  return Response.json({ ok: true, redirectTo: '/empresa' });
}
