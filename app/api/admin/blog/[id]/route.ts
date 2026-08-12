import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogPostInputSchema, isSlugChangeAllowed } from '@/lib/blog';
import {
  blogSlugCollides,
  blogSlugExists,
  deleteBlogPost,
  getAdminBlogPost,
  updateBlogPost,
} from '@/lib/db/blog';
import { invalidateBlogContent } from '@/lib/cache';
import { deleteImage } from '@/lib/image-storage';

async function loadId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id == null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminBlogPost(id);
    if (!existing) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = blogPostInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    // publishedAt is set once and never cleared (lib/db/blog.ts), so it is
    // the record of "this slug was ever live" even if the post is a draft
    // again right now.
    const wasEverPublished = existing.publishedAt !== null;
    if (!isSlugChangeAllowed(wasEverPublished, existing.slug, data.slug)) {
      return Response.json(
        {
          error:
            'Este artículo ya fue publicado — su slug es una URL pública indexada y no se puede cambiar. Si necesitás otra URL, creá un artículo nuevo.',
        },
        { status: 409 },
      );
    }

    if (data.slug !== existing.slug) {
      if (await blogSlugExists(data.slug, id)) {
        return Response.json({ error: 'Ya existe un artículo con ese slug.' }, { status: 409 });
      }
      if (await blogSlugCollides(data.slug)) {
        return Response.json(
          { error: 'Ese slug choca con una ruta existente del sitio. Elegí otro.' },
          { status: 409 },
        );
      }
    }

    await updateBlogPost(
      id,
      {
        slug: data.slug,
        title: data.title,
        description: data.description,
        category: data.category,
        body: data.body,
        coverImageKey: existing.coverImageKey,
        coverAlt: existing.coverAlt,
        coverWidth: existing.coverWidth,
        coverHeight: existing.coverHeight,
        status: data.status,
        relatedCategory: data.relatedCategory || null,
        relatedCity: data.relatedCity || null,
      },
      user.id,
      { wasPublished: wasEverPublished, publishedAt: existing.publishedAt },
    );

    // Covers publish, unpublish and plain edits to an already-published post
    // — any of which changes what the public site shows.
    if (data.status === 'published' || existing.status === 'published') invalidateBlogContent();

    return Response.json({ ok: true, slug: data.slug });
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

    // Delete the object before the row — same asymmetry as CVs and job
    // images: a row pointing at bytes that are gone renders one broken
    // image, an object with no row pointing at it can never be found again.
    if (existing.coverImageKey) {
      await deleteImage(existing.coverImageKey).catch(() => {});
    }

    await deleteBlogPost(id);

    if (existing.status === 'published') invalidateBlogContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
