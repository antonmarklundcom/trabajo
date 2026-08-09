import { z } from 'zod';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { setEmployerApplicationStatus, applicationStatusEnum } from '@/lib/db/employer';

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

    const changed = await setEmployerApplicationStatus(companyId, user.id, id, parsed.data.status);
    if (!changed) {
      return Response.json({ error: 'Postulación no encontrada.' }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
