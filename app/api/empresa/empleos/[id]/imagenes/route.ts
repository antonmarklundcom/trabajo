// POST /api/empresa/empleos/[id]/imagenes — add one photo to an employer's own
// job posting, 1–3 per job (PLAN-IMAGES.md §5).
//
// The body is the raw file, not multipart/form-data — same reasoning as
// app/api/postulante/cv/route.ts: request.formData() buffers the whole upload
// before yielding a field, which would make the 4 MB cap a thing measured
// after the damage.
import { authErrorResponse, requireApiCompanyScope } from '@/lib/auth';
import { employerDashboardEnabled } from '@/lib/flags';
import { addEmployerJobImage, MAX_JOB_IMAGES } from '@/lib/db/employer';
import { invalidatePublicContent } from '@/lib/cache';
import {
  IMAGE_REJECTION_MESSAGES,
  deleteImage,
  imagePublicUrl,
  readLimitedImageBody,
  storeImage,
} from '@/lib/image-storage';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

async function loadJobId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!employerDashboardEnabled()) return NOT_FOUND();

  try {
    const { companyId, user } = await requireApiCompanyScope();

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
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[processed.reason] }, { status: 400 });
    }

    const result = await addEmployerJobImage(companyId, user.id, jobId, processed);
    if (!result.ok) {
      // The bytes are already on disk/R2 by this point; a refused row means
      // nothing will ever point at them, so they are removed immediately
      // rather than left for a sweeper that does not exist (PLAN-IMAGES.md §6).
      await deleteImage(processed.key).catch(() => {});
      return result.reason === 'not_found'
        ? Response.json({ error: 'Empleo no encontrado.' }, { status: 404 })
        : Response.json(
            { error: `Ya tenés el máximo de ${MAX_JOB_IMAGES} imágenes por empleo.` },
            { status: 409 },
          );
    }

    // A new image on a published job is visible immediately, same as any
    // other employer edit that keeps a job published.
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
