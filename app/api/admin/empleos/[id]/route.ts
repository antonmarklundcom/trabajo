import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { deleteJob, getAdminJob, jobSlugExists, updateJobWithLaunchPromo } from '@/lib/db/admin';
import { invalidateLaunchPromo, invalidatePublicContent } from '@/lib/cache';
import { launchPromoEnabled } from '@/lib/promo';
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
  rejectionReason: z.string().max(2000).nullable().optional(),
  // Slugs are live SEO URLs (AGENTS.md). Renaming one on a published job
  // needs an explicit confirmation from the editor, who is told a 301 is
  // needed — this app has no automated redirect issuance yet.
  confirmSlugChange: z.boolean().optional(),
  // The launch promotion (PLAN-GROWTH.md §4 P1). A REQUEST, not a decision:
  // the handler grants only if this save is also the transition to
  // `published`, the flag is on, the quota is unspent and this job has no
  // promo grant already — and all four are re-checked server-side, inside the
  // same transaction as the status write. A client that sends `true` on an
  // edit, on a rejection, or on a listing that already ran the promotion gets
  // its edit saved and nothing granted.
  applyLaunchPromo: z.boolean().optional(),
}).refine((data) => data.status !== 'rejected' || !!data.rejectionReason?.trim(), {
  message: 'El motivo de rechazo es obligatorio.',
  path: ['rejectionReason'],
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

    const promo = await updateJobWithLaunchPromo(
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
        rejectionReason: data.rejectionReason ?? null,
      },
      user.id,
      {
        applyLaunchPromo: data.applyLaunchPromo === true,
        // Read here rather than inside the transaction so the flag is one
        // request's worth of truth: an operator who saw the checkbox is the
        // operator whose save is evaluated against the flag they saw.
        promoEnabled: launchPromoEnabled(),
      },
    );

    // Covers publish, unpublish, reject, archive, feature and plain edits —
    // any of which changes what the public site shows. A slug change is
    // covered too: the '/empleos/[slug]' pattern invalidates every job page,
    // so the old URL stops being served from cache as well.
    invalidatePublicContent();
    // Only on an actual grant: the counter the public promo copy renders moved,
    // and nothing else in this handler can move it.
    if (promo.granted) invalidateLaunchPromo();

    return Response.json({
      ok: true,
      slug,
      promoGranted: promo.granted,
      promoFeaturedUntil: promo.granted ? promo.featuredUntil.toISOString() : null,
    });
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

    // A deleted job must stop being served immediately — this is the case
    // where stale-while-revalidate would be actively wrong.
    invalidatePublicContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
