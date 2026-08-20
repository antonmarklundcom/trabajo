// GET /api/empresa/cv/[applicationId] — an employer downloads the CV attached
// to an application submitted to one of its own postings.
//
// PLAN-PHASE2.md §3.3, row 2. Two things about this route are deliberate:
//
//   - It keys on the APPLICATION, not on the CV id. An employer's right to a
//     CV comes from the application, so the URL carries that relationship
//     instead of making the handler reconstruct it — and a CV id an employer
//     happens to learn is not, on its own, a thing this route accepts.
//   - The company check and the `redacted_at IS NULL` check live together in
//     getEmployerApplicationCv()'s WHERE clause. A withdrawn consent removes
//     the file from the employer's reach in the same query that scopes it, so
//     there is no ordering between the two checks to get wrong.
//
// Not logged, per §1.2: this is data the candidate consented to share with
// this employer, and logging it would be noise on top of the signal.
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { cvDownloadResponse } from '@/lib/cv';
import { getEmployerApplicationCv } from '@/lib/db/employer';
import { captureError } from '@/lib/observability';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  if (!employerDashboardEnabled()) return NOT_FOUND();

  try {
    const { companyId } = await requireApiCompanyScope();

    const applicationId = Number((await params).applicationId);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const cv = await getEmployerApplicationCv(companyId, applicationId);
    // Another company's application, an application with no CV, and a redacted
    // application are all the same 404. The employer UI already knows which of
    // those it is from the application row itself, so this response never has
    // to distinguish them.
    if (!cv) return NOT_FOUND();

    return cvDownloadResponse(cv);
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('cv:employer-download', err);
    return Response.json({ error: 'No pudimos abrir el CV.' }, { status: 500 });
  }
}
