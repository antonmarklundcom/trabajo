// POST/DELETE /api/postulante/guardados — save/unsave a job for the logged-in
// candidate ("Guardar"/"Guardado" toggle on /empleos/[slug]). Mirrors
// /api/postulante/postulaciones: candidateId comes only from the session,
// never from the request body.
import { z } from 'zod';
import { clientIpOrUnknown } from '@/lib/client-ip';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { saveJob, unsaveJob } from '@/lib/db/candidate-saved-jobs';
import { isSavedJobLimited } from '@/lib/candidate-write-limiter';

const schema = z.object({ jobSlug: z.string().min(1) });

export async function POST(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const candidate = await requireApiCandidate();

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    // Both verbs share one budget: an unsave is the same row-churn as a save,
    // and a toggle loop alternates between them.
    if (isSavedJobLimited(clientIpOrUnknown(request.headers), candidate.id)) {
      return Response.json(
        { error: 'Demasiadas acciones seguidas. Esperá un minuto.' },
        { status: 429 },
      );
    }

    const result = await saveJob(candidate.id, parsed.data.jobSlug);
    if (!result.ok) {
      return Response.json({ error: 'Este empleo ya no está disponible.' }, { status: 404 });
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!candidateAccountsEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const candidate = await requireApiCandidate();

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    // Both verbs share one budget: an unsave is the same row-churn as a save,
    // and a toggle loop alternates between them.
    if (isSavedJobLimited(clientIpOrUnknown(request.headers), candidate.id)) {
      return Response.json(
        { error: 'Demasiadas acciones seguidas. Esperá un minuto.' },
        { status: 429 },
      );
    }

    await unsaveJob(candidate.id, parsed.data.jobSlug);
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
