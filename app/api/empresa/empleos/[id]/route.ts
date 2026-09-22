import { after } from 'next/server';
import { z } from 'zod';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { getEmployerJob, updateEmployerJob } from '@/lib/db/employer';
import { notifyTeamOfPendingJob } from '@/lib/notifications';
import { invalidatePublicContent } from '@/lib/cache';
import { contractTypeEnum, seniorityEnum, modalityEnum } from '@/lib/db/schema';

const jobSchema = z.object({
  title: z.string().min(3).max(255),
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
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const { companyId, user } = await requireApiCompanyScope();

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    // Read before and after only to learn whether this edit put the job INTO
    // the moderation queue (a resubmission after a rejection, or a material
    // edit to a published listing). Both reads are company-scoped; ownership
    // is still enforced by updateEmployerJob()'s own WHERE clause.
    const before = await getEmployerJob(companyId, id);
    const changed = await updateEmployerJob(companyId, user.id, id, parsed.data);
    if (!changed) {
      return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });
    }
    const afterEdit = await getEmployerJob(companyId, id);
    if (before && afterEdit && afterEdit.status === 'pending' && before.status !== 'pending') {
      after(() =>
        notifyTeamOfPendingJob({ companyId, jobId: id, title: afterEdit.title, resubmitted: true }),
      );
    }

    // The edit may have kept the job published (e.g. a whatsapp-only change)
    // or sent a published job back to pending — either way the public site's
    // output can change, so this always invalidates rather than trying to
    // infer it from the material-change outcome.
    invalidatePublicContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
