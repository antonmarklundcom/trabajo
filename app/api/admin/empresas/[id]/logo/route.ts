// POST /api/admin/empresas/[id]/logo — admin/editor upload (or replace) of a
// company's logo. DELETE removes it. Same mechanics as
// app/api/empresa/logo/route.ts; the only difference is the auth path — this
// one is not scoped by session companyId, it takes `id` from the URL like
// every other admin company route.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { uploadCompanyLogo, removeCompanyLogoObject } from '@/lib/company-logo';
import { getAdminCompany, updateCompanyLogo } from '@/lib/db/admin';
import { invalidatePublicContent } from '@/lib/cache';

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const company = await getAdminCompany(id);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });

    const result = await uploadCompanyLogo(request, company.logoKey);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    await updateCompanyLogo(id, result.key, user.id);
    invalidatePublicContent();

    return Response.json({ key: result.key, url: result.url }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const company = await getAdminCompany(id);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });

    if (company.logoKey) {
      await removeCompanyLogoObject(company.logoKey);
      await updateCompanyLogo(id, null, user.id);
      invalidatePublicContent();
    }

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
