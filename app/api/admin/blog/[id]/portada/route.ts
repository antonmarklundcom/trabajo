// POST/DELETE /api/admin/blog/[id]/portada — the blog cover image, admin/
// editor only. Store-then-delete ordering (commit 1dd682c, PLAN-IMAGES.md
// §5): a rejected upload must never touch the live cover.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { validateCoverAlt } from '@/lib/blog';
import { getAdminBlogPost, updateBlogPost } from '@/lib/db/blog';
import { invalidateBlogContent } from '@/lib/cache';
import {
  IMAGE_REJECTION_MESSAGES,
  deleteImage,
  imagePublicUrl,
  readLimitedImageBody,
  storeBlogCover,
} from '@/lib/image-storage';

async function loadId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminBlogPost(id);
    if (!existing) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    // coverAlt travels as a header, same shape as a multipart field but
    // without pulling in a multipart parser for one field — the body is the
    // raw image bytes, exactly like the job-image and logo upload routes.
    const alt = request.headers.get('x-cover-alt')?.trim() ?? '';
    if (!validateCoverAlt('pending', alt)) {
      return Response.json(
        { error: 'El texto alternativo de la portada es obligatorio (describí la imagen, en español).' },
        { status: 400 },
      );
    }

    const body = await readLimitedImageBody(request);
    if (!body.ok) {
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[body.reason] }, {
        status: body.reason === 'too_large' ? 413 : 400,
      });
    }

    const processed = await storeBlogCover(body.bytes);
    if (!processed.ok) {
      return Response.json({ error: IMAGE_REJECTION_MESSAGES[processed.reason] }, { status: 400 });
    }

    const oldKey = existing.coverImageKey;

    await updateBlogPost(
      id,
      {
        slug: existing.slug,
        title: existing.title,
        description: existing.description,
        category: existing.category,
        body: existing.body,
        coverImageKey: processed.key,
        coverAlt: alt,
        coverWidth: processed.width,
        coverHeight: processed.height,
        status: existing.status,
        relatedCategory: existing.relatedCategory,
        relatedCity: existing.relatedCity,
      },
      user.id,
      { wasPublished: existing.publishedAt !== null, publishedAt: existing.publishedAt },
    );

    // Delete the old object only after the new one is stored and the row
    // updated — a failed delete leaves an orphan, which is preferable to a
    // broken row.
    if (oldKey) await deleteImage(oldKey).catch(() => {});

    if (existing.status === 'published') invalidateBlogContent();

    return Response.json(
      {
        url: imagePublicUrl(processed.key),
        width: processed.width,
        height: processed.height,
        alt,
      },
      { status: 201 },
    );
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminBlogPost(id);
    if (!existing) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    if (existing.coverImageKey) {
      await deleteImage(existing.coverImageKey).catch(() => {});
      await updateBlogPost(
        id,
        {
          slug: existing.slug,
          title: existing.title,
          description: existing.description,
          category: existing.category,
          body: existing.body,
          coverImageKey: null,
          coverAlt: null,
          coverWidth: null,
          coverHeight: null,
          status: existing.status,
          relatedCategory: existing.relatedCategory,
          relatedCity: existing.relatedCity,
        },
        user.id,
        { wasPublished: existing.publishedAt !== null, publishedAt: existing.publishedAt },
      );
      if (existing.status === 'published') invalidateBlogContent();
    }

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
