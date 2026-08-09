// POST /api/postulante/postulaciones — one-click apply (PLAN-PHASE2.md §4.1
// consent #2). The anonymous lead form (POST /api/v1/leads) is untouched;
// this is a second, parallel write path for logged-in candidates only.
import { z } from 'zod';
import { authErrorResponse } from '@/lib/auth';
import { requireApiCandidate } from '@/lib/auth-candidate';
import { candidateAccountsEnabled } from '@/lib/flags';
import { createCandidateApplication } from '@/lib/db/candidate-applications';

const schema = z.object({
  jobSlug: z.string().min(1),
  message: z.string().max(1000).nullable().optional(),
  consentAccepted: z.literal(true),
});

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

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

    const result = await createCandidateApplication(candidate.id, {
      jobSlug: parsed.data.jobSlug,
      message: parsed.data.message ?? null,
      ip: clientIp(request),
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
