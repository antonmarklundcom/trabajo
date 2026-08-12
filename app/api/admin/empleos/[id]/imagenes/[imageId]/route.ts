// DELETE /api/admin/empleos/[id]/imagenes/[imageId] — admin removes any job's
// photo.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { deleteAdminJobImage } from '@/lib/db/admin';
import { invalidatePublicContent } from '@/lib/cache';

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
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const ids = await loadIds(params);
    if (!ids) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const deleted = await deleteAdminJobImage(ids.jobId, user.id, ids.imageId);
    if (!deleted) return Response.json({ error: 'Imagen no encontrada.' }, { status: 404 });

    invalidatePublicContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
