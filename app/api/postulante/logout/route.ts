import { destroyCandidateSession } from '@/lib/auth-candidate';

export async function POST() {
  await destroyCandidateSession();
  return Response.json({ ok: true });
}
