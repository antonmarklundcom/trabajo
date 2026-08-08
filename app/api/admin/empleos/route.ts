import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { createJob, jobSlugExists } from '@/lib/db/admin';
import { invalidatePublicContent } from '@/lib/cache';
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
});

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    const slugBase = data.slug?.trim() || data.title;
    const slug = await uniqueSlug(slugify(slugBase), (candidate) => jobSlugExists(candidate));

    const id = await createJob(
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

    // A job created straight as `published` must be on the public site now,
    // not after the route timer lapses. Unconditional because `status` is
    // caller-supplied and a draft costs nothing to invalidate.
    invalidatePublicContent();

    return Response.json({ ok: true, id, slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
