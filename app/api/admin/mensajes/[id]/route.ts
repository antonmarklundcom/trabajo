import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { markContactMessageHandled } from '@/lib/db/contact-messages';

// The one mutation on a contact message: "Marcar como atendido". Same role set
// as the page (admin + editor); checked here because the page hiding the
// button is UX, not security (AGENTS.md).
const schema = z.object({ handled: z.literal(true) });

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
    if (!schema.safeParse(body).success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    const updated = await markContactMessageHandled(id, user.id);
    if (!updated) {
      return Response.json(
        { error: 'El mensaje no existe o ya estaba marcado como atendido.' },
        { status: 409 },
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
