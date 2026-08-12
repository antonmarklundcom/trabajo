// DELETE /api/empresa/empleos/[id]/imagenes/[imageId] — remove one photo from
// an employer's own job posting.
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { deleteEmployerJobImage } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

async function loadIds(
  params: Promise<{ id: string; imageId: string }>,
): Promise<{ jobId: number; imageId: number } | null> {
  const { id, imageId } = await params;
  const jobId = Number(id);
  const numImageId = Number(imageId);
  if (!Number.isInteger(jobId) || jobId <= 0) return null;
  if (!Number.isInteger(numImageId) || numImageId <= 0) return null;
  return { jobId, imageId: numImageId };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  if (!employerDashboardEnabled()) return NOT_FOUND();

  try {
    const { companyId, user } = await requireApiCompanyScope();

    const ids = await loadIds(params);
    if (!ids) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const deleted = await deleteEmployerJobImage(companyId, user.id, ids.jobId, ids.imageId);
    if (!deleted) return Response.json({ error: 'Imagen no encontrada.' }, { status: 404 });

    invalidatePublicContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
