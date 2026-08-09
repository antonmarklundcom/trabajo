// POST /api/postulante/postulaciones/[id]/retirar — withdraw consent for one
// application (PLAN-PHASE2.md §4.2). Append-only consent ledger + redaction,
// not a delete: the candidate's own history still shows the withdrawal.
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { withdrawApplicationConsent } from '@/lib/db/candidate-applications';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();
    const id = parseId((await params).id);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const withdrawn = await withdrawApplicationConsent(candidate.id, id);
    if (!withdrawn) return NOT_FOUND();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
