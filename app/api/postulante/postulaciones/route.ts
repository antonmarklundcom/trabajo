// POST /api/postulante/postulaciones — one-click apply (PLAN-PHASE2.md §4.1
// consent #2). The anonymous lead form (POST /api/v1/leads) is untouched;
// this is a second, parallel write path for logged-in candidates only.
import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { z } from 'zod';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { createCandidateApplication } from '@/lib/db/candidate-applications';
import { isApplicationLimited } from '@/lib/candidate-write-limiter';

const schema = z.object({
  jobSlug: z.string().min(1),
  message: z.string().max(1000).nullable().optional(),
  consentAccepted: z.literal(true),
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
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    // After the session is established, so the budget is per candidate, and
    // before the write, so a refused request costs nothing but the parse.
    if (isApplicationLimited(clientIpOrUnknown(request.headers), candidate.id)) {
      return Response.json(
        { error: 'Demasiadas postulaciones seguidas. Esperá un minuto.' },
        { status: 429 },
      );
    }

    const result = await createCandidateApplication(candidate.id, {
      jobSlug: parsed.data.jobSlug,
      message: parsed.data.message ?? null,
      ip: clientIp(request.headers),
      userAgent: request.headers.get('user-agent'),
    });

    if (!result.ok) {
      if (result.reason === 'already_applied') {
        return Response.json({ error: 'Ya te postulaste a este empleo.' }, { status: 409 });
      }
      return Response.json({ error: 'Este empleo ya no está disponible.' }, { status: 404 });
    }

    return Response.json({ ok: true, applicationId: result.applicationId }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
