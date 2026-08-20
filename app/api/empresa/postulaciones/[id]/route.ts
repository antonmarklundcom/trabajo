import { after } from 'next/server';
import { z } from 'zod';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { setEmployerApplicationStatus, applicationStatusEnum } from '@/lib/db/employer';
import { notifyCandidateOfContact } from '@/lib/notifications';

const schema = z.object({ status: z.enum(applicationStatusEnum) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // The layout's notFound() only guards page routes. This route handler sits
  // outside app/empresa/layout.tsx, so it must repeat the flag check itself —
  // otherwise a disabled dashboard would still accept writes.
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const { companyId, user } = await requireApiCompanyScope();

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    const result = await setEmployerApplicationStatus(companyId, user.id, id, parsed.data.status);
    if (!result.changed) {
      return Response.json({ error: 'Postulación no encontrada.' }, { status: 404 });
    }

    // N3, and only on the TRANSITION into `contacted`. Re-clicking the status
    // the row is already on still counts as a changed row — this UPDATE always
    // writes a fresh statusChangedAt — so without the previous status an
    // employer tidying their list would mail the candidate once per click.
    if (parsed.data.status === 'contacted' && result.previousStatus !== 'contacted') {
      after(() => notifyCandidateOfContact({ companyId, applicationId: id }));
    }

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
