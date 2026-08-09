import { z } from 'zod';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { deleteCandidateExperience, updateCandidateExperience } from '@/lib/db/candidate-profile';

const schema = z.object({
  companyName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  startMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/)
    .nullable(),
  isCurrent: z.boolean(),
  description: z.string().max(2000).nullable(),
});

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();
    const id = parseId((await params).id);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const updated = await updateCandidateExperience(candidate.id, id, parsed.data);
    if (!updated) return NOT_FOUND();
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();
    const id = parseId((await params).id);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const deleted = await deleteCandidateExperience(candidate.id, id);
    if (!deleted) return NOT_FOUND();
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
