// GET /api/postulante/postulaciones/estado?jobSlug=... — whether the visitor
// is a logged-in candidate and has already applied to this job.
//
// Deliberately a client-fetched endpoint rather than a server-component read:
// app/empleos/[slug]/page.tsx is a cached ISR page (`revalidate = 300`,
// generateStaticParams). Reading the candidate session there via cookies()
// would force the whole route dynamic per Next 16's cookies() contract
// (node_modules/next/dist/docs) — losing static generation for a page that
// exists specifically to be cheap to serve. Isolating the cookie read to a
// small client fetch keeps the page static and this one check dynamic.
import { getCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { hasCandidateApplied } from '@/lib/db/candidate-applications';

export async function GET(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ loggedIn: false }, { status: 404 });
  }

  const jobSlug = new URL(request.url).searchParams.get('jobSlug');
  if (!jobSlug) return Response.json({ error: 'jobSlug requerido.' }, { status: 400 });

  const candidate = await getCandidate();
  if (!candidate) return Response.json({ loggedIn: false });

  const alreadyApplied = await hasCandidateApplied(candidate.id, jobSlug);
  return Response.json({ loggedIn: true, alreadyApplied });
}
