import { z } from 'zod';
import { COMPANY_WEBSITE_ERROR, companyWebsiteSchema } from '@/lib/company-website';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { companySlugExists, createCompany } from '@/lib/db/admin';
import { invalidatePublicContent } from '@/lib/cache';
import { slugify, uniqueSlug } from '@/lib/slug';

const companySchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().max(255).optional(),
  whatsapp: z.string().max(20).nullable(),
  website: companyWebsiteSchema,
  description: z.string().max(5000).nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      const websiteInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'website');
      return Response.json(
        { error: websiteInvalid ? COMPANY_WEBSITE_ERROR : 'Datos inválidos.', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const slugBase = data.slug?.trim() || data.name;
    const slug = await uniqueSlug(slugify(slugBase), (candidate) => companySlugExists(candidate));

    const id = await createCompany(
      {
        name: data.name,
        slug,
        whatsapp: data.whatsapp,
        website: data.website,
        description: data.description,
      },
      user.id,
    );

    // A brand-new company has no jobs yet, so nothing public changes. Invalidate
    // anyway: it is one cheap call, and it keeps every mutating handler in this
    // tree following the same rule instead of relying on that staying true.
    invalidatePublicContent();

    return Response.json({ ok: true, id, slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
