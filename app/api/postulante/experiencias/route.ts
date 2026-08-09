import { z } from 'zod';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { createCandidateExperience } from '@/lib/db/candidate-profile';

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

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const candidate = await requireApiCandidate();

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const id = await createCandidateExperience(candidate.id, parsed.data);
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
