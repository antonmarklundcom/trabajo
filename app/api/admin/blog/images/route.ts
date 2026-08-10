// POST /api/admin/blog/images — upload an image for use inside a blog post
// (featured image or inline, via the Tiptap editor's "+ Imagen" button).
//
// Raw body upload, same shape as app/api/postulante/cv/route.ts and the
// reasoning there: request.formData() buffers the whole body before yielding
// a field, which would make readLimitedImageBody's streamed cap decorative.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import {
  IMAGE_REJECTION_MESSAGES,
  readLimitedImageBody,
  storeImage,
  imagePublicUrl,
  MAX_IMAGE_UPLOAD_BYTES,
} from '@/lib/image-storage';

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await readLimitedImageBody(request);
    if (!body.ok) {
      return body.reason === 'too_large'
        ? Response.json(
            { error: `La imagen supera los ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB.` },
            { status: 413 },
          )
        : Response.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const result = await storeImage('blog', body.bytes);
    if (!result.ok) {
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[result.reason] }, { status: 422 });
    }

    return Response.json({ key: result.key, url: imagePublicUrl(result.key) });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
