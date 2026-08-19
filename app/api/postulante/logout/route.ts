import { destroyCandidateSession, getCandidate } from '@/lib/auth-candidate';
import { clientIp } from '@/lib/client-ip';
import { recordAuthEvent } from '@/lib/db/auth-events';

export async function POST(request: Request) {
  // Read the identity BEFORE destroying the session — afterwards there is
  // nobody to attribute the event to.
  const candidate = await getCandidate();
  await destroyCandidateSession();

  if (candidate) {
    await recordAuthEvent({
      surface: 'postulante',
      event: 'logout',
      candidateId: candidate.id,
      ip: clientIp(request.headers),
    });
  }

  return Response.json({ ok: true });
}
