// POST /api/empresa/logo — upload (or replace) the logged-in employer's own
// company logo. DELETE removes it. Mirrors app/api/postulante/cv/route.ts's
// shape: raw body, not multipart/form-data, so the streamed size limit in
// readLimitedImageBody() actually bounds the request instead of running
// after request.formData() has already buffered everything.
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { uploadCompanyLogo, removeCompanyLogoObject } from '@/lib/company-logo';
import { getEmployerCompany, updateEmployerCompany } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';
import { captureError } from '@/lib/observability';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

export async function POST(request: Request) {
  if (!employerDashboardEnabled()) return NOT_FOUND();

  try {
    const { companyId, user } = await requireApiCompanyScope();
    const company = await getEmployerCompany(companyId);
    if (!company) return NOT_FOUND();

    const result = await uploadCompanyLogo(request, company.logoKey);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    await updateEmployerCompany(companyId, user.id, { logoKey: result.key });
    invalidatePublicContent();

    return Response.json({ key: result.key, url: result.url }, { status: 201 });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('empresa:logo-upload', err);
    return Response.json({ error: 'No pudimos guardar el logo. Intentá de nuevo.' }, { status: 500 });
  }
}

export async function DELETE() {
  if (!employerDashboardEnabled()) return NOT_FOUND();

  try {
    const { companyId, user } = await requireApiCompanyScope();
    const company = await getEmployerCompany(companyId);
    if (!company) return NOT_FOUND();

    if (company.logoKey) {
      await removeCompanyLogoObject(company.logoKey);
      await updateEmployerCompany(companyId, user.id, { logoKey: null });
      invalidatePublicContent();
    }

    return Response.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('empresa:logo-remove', err);
    return Response.json({ error: 'No pudimos quitar el logo. Intentá de nuevo.' }, { status: 500 });
  }
}
