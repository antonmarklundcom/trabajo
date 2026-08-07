import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { deleteJob, getAdminJob, jobSlugExists, updateJob } from '@/lib/db/admin';
import { slugify, uniqueSlug } from '@/lib/slug';
import { jobStatusEnum, contractTypeEnum, seniorityEnum, modalityEnum } from '@/lib/db/schema';

const jobSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().max(200).optional(),
  companyId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  cityId: z.number().int().positive(),
  contractType: z.enum(contractTypeEnum),
  seniority: z.enum(seniorityEnum),
  modality: z.enum(modalityEnum),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryMax: z.number().int().nonnegative().nullable(),
  salaryHidden: z.boolean(),
  description: z.string().min(20).max(10000),
  whatsapp: z.string().max(20).nullable(),
  status: z.enum(jobStatusEnum),
  featuredUntil: z.string().datetime().nullable().optional(),
  // Slugs are live SEO URLs (AGENTS.md). Renaming one on a published job
  // needs an explicit confirmation from the editor, who is told a 301 is
  // needed — this app has no automated redirect issuance yet.
  confirmSlugChange: z.boolean().optional(),
});

async function loadId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminJob(id);
    if (!existing) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    let slug = existing.slug;
    const requestedSlug = data.slug?.trim();
    if (requestedSlug && slugify(requestedSlug) !== existing.slug) {
      if (existing.status === 'published' && !data.confirmSlugChange) {
        return Response.json(
          {
            error:
              'Este empleo está publicado. Cambiar el slug rompe la URL actual — confirmá el cambio y configurá un redirect 301.',
            requiresConfirmation: true,
          },
          { status: 409 },
        );
      }
      slug = await uniqueSlug(slugify(requestedSlug), (candidate) => jobSlugExists(candidate, id));
    }

    await updateJob(
      id,
      {
        slug,
        title: data.title,
        companyId: data.companyId,
        categoryId: data.categoryId,
        cityId: data.cityId,
        contractType: data.contractType,
        seniority: data.seniority,
        modality: data.modality,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryHidden: data.salaryHidden,
        description: data.description,
        whatsapp: data.whatsapp,
        status: data.status,
        featuredUntil: data.featuredUntil ? new Date(data.featuredUntil) : null,
      },
      user.id,
    );

    return Response.json({ ok: true, slug });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminJob(id);
    if (!existing) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    await deleteJob(id, user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
