import { z } from 'zod';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { updateCandidateProfile } from '@/lib/db/candidate-profile';

const schema = z.object({
  name: z.string().min(2).max(200),
  phone: z.string().min(6).max(20),
  cityId: z.number().int().positive().nullable(),
  headline: z.string().max(200).nullable(),
});

export async function PATCH(request: Request) {
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

    await updateCandidateProfile(candidate.id, parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
