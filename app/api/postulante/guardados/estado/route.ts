// GET /api/postulante/guardados/estado?jobSlug=... — whether the visitor is a
// logged-in candidate and has already saved this job.
//
// Client-fetched for the same reason as /api/postulante/postulaciones/estado:
// app/empleos/[slug]/page.tsx is a cached ISR page (`revalidate = 300`), so
// reading the candidate session there via cookies() would force the whole
// route dynamic (Next 16's cookies() contract). Isolating the cookie read to a
// small client fetch keeps the page static and this one check dynamic.
import { getCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { isJobSaved } from '@/lib/db/candidate-saved-jobs';

export async function GET(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ loggedIn: false }, { status: 404 });
  }

  const jobSlug = new URL(request.url).searchParams.get('jobSlug');
  if (!jobSlug) return Response.json({ error: 'jobSlug requerido.' }, { status: 400 });

  const candidate = await getCandidate();
  if (!candidate) return Response.json({ loggedIn: false });

  const saved = await isJobSaved(candidate.id, jobSlug);
  return Response.json({ loggedIn: true, saved });
}
