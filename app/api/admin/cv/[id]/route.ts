// GET /api/admin/cv/[id]?motivo=… — the platform operator downloads a CV.
//
// PLAN-PHASE2.md §3.3, row 3: role exactly `admin`, a reason is mandatory, and
// the access is written to data_access_logs. This is the narrowest and most
// dangerous of the three paths, so it is the only one that is logged and the
// only one an `editor` cannot use.
//
// The authorization and the logging are NOT implemented here. They live inside
// viewCandidateCvAsAdmin() (lib/db/candidates-admin.ts), which cannot return a
// CV without first writing the log row — §2.4's "impossible to bypass"
// construction. This handler's whole job is to turn a URL into that call and an
// error into a status code.
import { authErrorResponse, requireApiSession } from '@/lib/auth';
import { cvDownloadResponse } from '@/lib/cv';
import {
  MAX_REASON_LENGTH,
  ReasonRequiredError,
  viewCandidateCvAsAdmin,
} from '@/lib/db/candidates-admin';
import { clientIp } from '@/lib/client-ip';
import { captureError } from '@/lib/observability';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    // Spanish param name to match the admin UI that will link here in PR 12.
    const reason = new URL(request.url).searchParams.get('motivo') ?? '';
    if (reason.length > MAX_REASON_LENGTH) {
      return Response.json({ error: 'El motivo es demasiado largo.' }, { status: 400 });
    }

    // Role is re-checked inside (exactly `admin`, not `editor`); requireApiSession
    // only establishes who is asking.
    // clientIp() returns null when the request did not arrive through the
    // expected proxy chain, and the log column stores that NULL rather than a
    // word that reads like an address — or, worse, an attacker-chosen one.
    const cv = await viewCandidateCvAsAdmin(user, id, reason, {
      ip: clientIp(request.headers),
    });
    if (!cv) return Response.json({ error: 'No encontrado.' }, { status: 404 });

    return cvDownloadResponse(cv);
  } catch (err) {
    if (err instanceof ReasonRequiredError) {
      return Response.json(
        { error: 'Indicá el motivo del acceso (parámetro "motivo").' },
        { status: 400 },
      );
    }
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('cv:admin-download', err);
    return Response.json({ error: 'No pudimos abrir el CV.' }, { status: 500 });
  }
}
