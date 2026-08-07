import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { companySlugExists, getAdminCompany, updateCompany } from '@/lib/db/admin';
import { slugify, uniqueSlug } from '@/lib/slug';

const companySchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().max(255).optional(),
  logoUrl: z.string().max(500).nullable(),
  whatsapp: z.string().max(20).nullable(),
  website: z.string().max(500).nullable(),
  description: z.string().max(5000).nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const existing = await getAdminCompany(id);
    if (!existing) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    let slug = existing.slug;
    const requestedSlug = data.slug?.trim();
    if (requestedSlug && slugify(requestedSlug) !== existing.slug) {
      slug = await uniqueSlug(slugify(requestedSlug), (candidate) => companySlugExists(candidate, id));
    }

    await updateCompany(
      id,
      {
        name: data.name,
        slug,
        logoUrl: data.logoUrl,
        whatsapp: data.whatsapp,
        website: data.website,
        description: data.description,
      },
      user.id,
    );

    return Response.json({ ok: true, slug });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
