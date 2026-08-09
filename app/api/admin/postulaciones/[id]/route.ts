import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { updateApplicationStatus } from '@/lib/db/admin';
import { applicationStatusEnum } from '@/lib/db/schema';

const schema = z.object({ status: z.enum(applicationStatusEnum) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

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

    await updateApplicationStatus(id, parsed.data.status);
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
