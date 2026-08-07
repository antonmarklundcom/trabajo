import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { companySlugExists, createCompany } from '@/lib/db/admin';
import { slugify, uniqueSlug } from '@/lib/slug';

const companySchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().max(255).optional(),
  logoUrl: z.string().max(500).nullable(),
  whatsapp: z.string().max(20).nullable(),
  website: z.string().max(500).nullable(),
  description: z.string().max(5000).nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const slugBase = data.slug?.trim() || data.name;
    const slug = await uniqueSlug(slugify(slugBase), (candidate) => companySlugExists(candidate));

    const id = await createCompany(
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

    return Response.json({ ok: true, id, slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
