// POST /api/admin/empleos/[id]/imagenes — admin can edit any job's photos,
// same 1–3 rule and pipeline as the employer route (PLAN-IMAGES.md §5).
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { addAdminJobImage, MAX_JOB_IMAGES } from '@/lib/db/admin';
import { invalidatePublicContent } from '@/lib/cache';
import {
  IMAGE_REJECTION_MESSAGES,
  deleteImage,
  imagePublicUrl,
  readLimitedImageBody,
  storeImage,
} from '@/lib/image-storage';

async function loadJobId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const jobId = await loadJobId(params);
    if (jobId == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const body = await readLimitedImageBody(request);
    if (!body.ok) {
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[body.reason] }, {
        status: body.reason === 'too_large' ? 413 : 400,
      });
    }

    const processed = await storeImage('jobs', body.bytes);
    if (!processed.ok) {
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[processed.reason] }, { status: 422 });
    }

    const result = await addAdminJobImage(jobId, user.id, processed);
    if (!result.ok) {
      await deleteImage(processed.key).catch(() => {});
      return result.reason === 'not_found'
        ? Response.json({ error: 'Empleo no encontrado.' }, { status: 404 })
        : Response.json(
            { error: `Ya tenés el máximo de ${MAX_JOB_IMAGES} imágenes por empleo.` },
            { status: 409 },
          );
    }

    invalidatePublicContent();

    return Response.json(
      {
        id: result.id,
        url: imagePublicUrl(processed.key),
        width: processed.width,
        height: processed.height,
      },
      { status: 201 },
    );
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
