// GET /api/postulante/mis-datos/export — ARCO *acceso*, self-service
// (PLAN-PHASE2.md §4.2 / PR 10).
//
// The candidate downloads everything we hold about them as one JSON file. This
// is deliberately the ONLY export surface in the product: §5.2 rules out a bulk
// export button in /admin precisely so that "we can produce your data" and "we
// can produce everybody's data" stay different sentences. If an ARCO access
// request ever arrives by email, the answer is to point the person at this
// route, not to build a staff-side equivalent.
//
// Not written to data_access_logs: that table records STAFF access to someone
// else's data (§2.4, and `actor_user_id` is a `users` id a candidate does not
// have). Logging the subject reading their own file would bury the signal the
// table exists to carry.
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { buildCandidateExport } from '@/lib/db/candidate-arco';
import { captureError } from '@/lib/observability';

export async function GET() {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const candidate = await requireApiCandidate();
    const data = await buildCandidateExport(candidate.id);
    // A live session whose candidate row is gone: possible for exactly as long
    // as it takes the browser to retry a request after §4.4 ran.
    if (!data) return Response.json({ error: 'No encontrado.' }, { status: 404 });

    const filename = `mis-datos-trabajo-com-py-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Fixed, ASCII, derived from a date — never from user input, so there is
        // nothing here to inject a header with.
        'content-disposition': `attachment; filename="${filename}"`,
        // This response is the most personal payload the app produces. It must
        // not sit in a CDN, a proxy or the browser's back/forward cache.
        'cache-control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('arco:export', err);
    return Response.json({ error: 'No pudimos generar tu archivo.' }, { status: 500 });
  }
}
