import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { getAdminUser, updateUser } from '@/lib/db/admin';

const userSchema = z.object({
  name: z.string().min(2).max(200),
  role: z.enum(['admin', 'editor', 'employer']),
  companyId: z.number().int().positive().nullable(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin']);

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const existing = await getAdminUser(id);
    if (!existing) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    // A user can't demote/disable themself out of the only admin seat by
    // accident from this screen — they'd lock themselves out with no other
    // admin able to fix it via the UI.
    if (existing.id === user.id && (data.role !== 'admin' || !data.isActive)) {
      return Response.json(
        { error: 'No podés cambiar tu propio rol ni desactivar tu propia cuenta.' },
        { status: 400 },
      );
    }

    await updateUser(
      id,
      {
        name: data.name,
        role: data.role,
        companyId: data.role === 'employer' ? data.companyId : null,
        isActive: data.isActive,
      },
      user.id,
    );

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
