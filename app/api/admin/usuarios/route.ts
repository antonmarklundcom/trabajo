import { z } from 'zod';
import { authErrorResponse, hashPassword, requireApiSession, requireRole } from '@/lib/auth';
import { createUser, emailExists } from '@/lib/db/admin';

const userSchema = z.object({
  email: z.string().min(1).email(),
  name: z.string().min(2).max(200),
  role: z.enum(['admin', 'editor', 'employer']),
  companyId: z.number().int().positive().nullable(),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin']);

    const body = await request.json().catch(() => null);
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    if (await emailExists(email)) {
      return Response.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);
    const id = await createUser(
      {
        email,
        name: data.name,
        role: data.role,
        companyId: data.role === 'employer' ? data.companyId : null,
        passwordHash,
      },
      user.id,
    );

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
