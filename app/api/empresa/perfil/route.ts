import { z } from 'zod';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { updateEmployerCompany } from '@/lib/db/employer';

// Deliberately no `name` or `slug` here — the company slug is a public SEO
// URL and the name is what the platform vouched for at invitation time.
const schema = z.object({
  whatsapp: z.string().max(20).nullable(),
  website: z.string().max(500).nullable(),
  description: z.string().max(5000).nullable(),
});

export async function PATCH(request: Request) {
  if (!employerDashboardEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const { companyId, user } = await requireApiCompanyScope();

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    await updateEmployerCompany(companyId, user.id, parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
