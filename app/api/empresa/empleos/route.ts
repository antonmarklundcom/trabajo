import { z } from 'zod';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { createEmployerJob } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';
import { contractTypeEnum, seniorityEnum, modalityEnum } from '@/lib/db/schema';

// No `slug`, `status`, `companyId` or `featuredUntil` — createEmployerJob()
// decides all of those itself (PLAN-PHASE2.md §6.1 / lib/db/employer.ts).
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

export async function POST(request: Request) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const { companyId, user } = await requireApiCompanyScope();

    const body = await request.json().catch(() => null);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const id = await createEmployerJob(companyId, user.id, parsed.data);

    // A brand-new employer job always lands `pending`, so nothing public
    // changes — invalidated anyway for the same reason admin's company POST
    // is: one cheap call, and it keeps every mutating handler consistent.
    invalidatePublicContent();

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
