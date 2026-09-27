import { z } from 'zod';
import { COMPANY_WEBSITE_ERROR, companyWebsiteSchema } from '@/lib/company-website';
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { updateEmployerCompany } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';

// Deliberately no `name` or `slug` here — the company slug is a public SEO
// URL and the name is what the platform vouched for at invitation time.
const schema = z.object({
  whatsapp: z.string().max(20).nullable(),
  website: companyWebsiteSchema,
  description: z.string().max(5000).nullable(),
  // N2. Not nullable: the column is NOT NULL with a default, and "unset" is
  // not a state the form can produce.
  notifyOnApplication: z.boolean(),
  // The weekly summary's opt-out (scripts/employer-digest.ts). Same reasoning:
  // a NOT NULL column with a default, and the form always sends it.
  notifyWeeklyDigest: z.boolean(),
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
      const websiteInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'website');
      return Response.json(
        { error: websiteInvalid ? COMPANY_WEBSITE_ERROR : 'Datos inválidos.', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const changed = await updateEmployerCompany(companyId, user.id, parsed.data);
    // The website feeds hiringOrganization.sameAs on every job of this company,
    // and the description and website are shown on /empresas/[slug] — so a
    // profile edit is a public-content write, same as the admin company edit.
    if (changed) invalidatePublicContent();
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
