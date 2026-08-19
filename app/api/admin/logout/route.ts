import { destroySession, getSessionUser } from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';

export async function POST(request: Request) {
  // Read the identity BEFORE destroying the session — afterwards there is
  // nobody to attribute the event to.
  const user = await getSessionUser();
  await destroySession();

  if (user) {
    await recordAuthEvent({
      surface: 'admin',
      event: 'logout',
      userId: user.id,
      ip: clientIp(request.headers),
    });
  }

  return Response.json({ ok: true });
}
