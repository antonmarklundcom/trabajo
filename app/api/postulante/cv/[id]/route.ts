// GET    /api/postulante/cv/[id] — the candidate downloads their own CV.
// DELETE /api/postulante/cv/[id] — the candidate deletes it.
//
// PLAN-PHASE2.md §3.3, row 1: the check is `cv.candidate_id ===
// session.candidateId`, and it is not written here — it is the WHERE clause of
// getCandidateCv(), which takes the candidate id as its first argument. Not
// logged: this is the data subject reading their own file, and logging it would
// bury the signal data_access_logs exists to carry.
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { cvDownloadResponse } from '@/lib/cv';
import { deleteCandidateCv, getCandidateCv } from '@/lib/db/candidate-cvs';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();
    const id = parseId((await params).id);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const cv = await getCandidateCv(candidate.id, id);
    // Another candidate's CV and a CV that does not exist are the same 404 on
    // purpose: a distinguishable response would confirm that an id is real.
    if (!cv) return NOT_FOUND();

    return cvDownloadResponse(cv);
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    console.error('[cv] candidate download failed', err);
    return Response.json({ error: 'No pudimos abrir el CV.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();
    const id = parseId((await params).id);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    // Object first, row second, and a storage failure propagates (§3.4) — see
    // deleteCandidateCv(). It is the reason this catch returns 500 rather than
    // reporting success: telling a candidate their CV is gone when the bytes
    // are still in a bucket is the one answer we must never give.
    const deleted = await deleteCandidateCv(candidate.id, id);
    if (!deleted) return NOT_FOUND();

    return Response.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    console.error('[cv] candidate delete failed', err);
    return Response.json(
      { error: 'No pudimos eliminar el CV. El archivo sigue guardado; intentá de nuevo.' },
      { status: 500 },
    );
  }
}
