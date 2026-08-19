// POST /api/postulante/mis-datos/eliminar — ARCO *cancelación*, self-service
// and immediate (PLAN-PHASE2.md §4.4, §8 Q6 assumed answer: no manual review
// step).
//
// Two confirmations are required before the destructive call, and neither is
// theatre:
//   - the current password, because this action is irreversible and a session
//     left open on a shared computer must not be enough to destroy an account;
//   - the literal word ELIMINAR, because a mis-click on a button that cannot be
//     undone is a support case we cannot fix afterwards — by design, since
//     there is no copy of the data left to restore.
//
// The password check goes through a rate limiter of its own, so this endpoint
// cannot become an unthrottled password oracle that the login form isn't — and,
// since B1, not the LOGIN limiter: sharing that instance meant five mistyped
// confirmations here locked the account out of logging in, and five failed
// logins locked it out of deleting itself (PLAN-PHASE3-DRAFT.md §13.3). This is
// the one path /privacidad promises; it does not share a budget.
import { clientIpOrUnknown } from '@/lib/client-ip';
import { z } from 'zod';

import { authErrorResponse } from '@/lib/auth';
import {
  authenticateCandidate,
  checkCandidateDeletionRateLimit,
  clearCandidateDeletionAttempts,
  destroyCandidateSession,
  recordFailedCandidateDeletion,
  requireApiCandidate,
} from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { deleteCandidateAccount } from '@/lib/db/candidate-arco';

const schema = z.object({
  password: z.string().min(1).max(200),
  confirm: z.literal('ELIMINAR'),
});

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const candidate = await requireApiCandidate();

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Escribí ELIMINAR y tu contraseña para confirmar.' },
        { status: 400 },
      );
    }

    const ip = clientIpOrUnknown(request.headers);
    const rateLimit = checkCandidateDeletionRateLimit(ip, candidate.email);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minuto(s).`,
        },
        { status: 429 },
      );
    }

    const verified = await authenticateCandidate(candidate.email, parsed.data.password);
    if (!verified || verified.id !== candidate.id) {
      recordFailedCandidateDeletion(ip, candidate.email);
      return Response.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
    }
    clearCandidateDeletionAttempts(ip, candidate.email);

    // Everything from here is PLAN-PHASE2.md §4.4, in order, inside one call.
    const counts = await deleteCandidateAccount(candidate.id, { requestedBy: 'candidate' });
    if (!counts) return Response.json({ error: 'No encontrado.' }, { status: 404 });

    // The cookie last: a session pointing at a candidate row that no longer
    // exists already resolves to null (getCandidate() joins on is_active and
    // finds nothing), so this is hygiene rather than the security boundary.
    await destroyCandidateSession();

    return Response.json({ ok: true, redirectTo: '/' });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    // A storage failure lands here (§4.4 step 2 hard-fails). Reporting success
    // while a CV is still in the bucket is the one answer this endpoint must
    // never give, so the message says plainly that nothing was deleted.
    console.error('[arco] account deletion failed', err);
    return Response.json(
      {
        error:
          'No pudimos completar la eliminación. Tus datos siguen guardados. ' +
          'Intentá de nuevo en unos minutos o escribinos desde /contacto.',
      },
      { status: 500 },
    );
  }
}
