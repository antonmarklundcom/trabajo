import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { getAdminCompany } from '@/lib/db/admin';
import { createEmployerInvitation } from '@/lib/db/employer-invitations';

const schema = z.object({ email: z.string().min(1).email() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    // Admin-only, not editor: this grants login access to a company's
    // applications, the same sensitivity as creating a staff user
    // (POST /api/admin/usuarios).
    requireRole(user, ['admin']);

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const company = await getAdminCompany(id);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const { token } = await createEmployerInvitation(id, parsed.data.email, user.id);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
    const inviteUrl = `${siteUrl}/empresa/activar?token=${token}`;

    return Response.json({ ok: true, inviteUrl }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
