// The cover image of an article.
//
//   POST   ?alt=...  raw image bytes → stored, key + alt written to the row
//   PATCH  {alt}     edit the alt text without re-uploading
//   DELETE           remove the object and clear both columns
//
// Alt text is a REQUIRED query parameter on upload rather than a field on the
// article form, so that "cover image without alt text" is not a state this API
// can produce. PLAN-PHASE3-DRAFT.md §10.1 made the same call for committed
// covers (zod superRefine, not a runtime `if` in the page) and PR #46 made it
// for job gallery images; the reasoning does not change because the bytes now
// arrive over HTTP.
import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { getAdminBlogPost, updateBlogCover } from '@/lib/db/blog';
import { removeBlogCoverObject, uploadBlogCover } from '@/lib/blog-cover';
import { invalidateBlogContent } from '@/lib/cache';

const altSchema = z.string().trim().min(1).max(200);

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

    const post = await getAdminBlogPost(id);
    if (!post) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    const alt = altSchema.safeParse(new URL(request.url).searchParams.get('alt') ?? '');
    if (!alt.success) {
      return Response.json(
        { error: 'El texto alternativo es obligatorio (máximo 200 caracteres).' },
        { status: 400 },
      );
    }

    const result = await uploadBlogCover(request, post.coverImageKey);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    await updateBlogCover(id, result.key, alt.data, user.id);
    invalidateBlogContent();

    return Response.json({ key: result.key, url: result.url, alt: alt.data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const post = await getAdminBlogPost(id);
    if (!post) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });
    if (!post.coverImageKey) {
      return Response.json({ error: 'Este artículo no tiene portada.' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const alt = altSchema.safeParse((body as { alt?: unknown } | null)?.alt ?? '');
    if (!alt.success) {
      return Response.json(
        { error: 'El texto alternativo es obligatorio (máximo 200 caracteres).' },
        { status: 400 },
      );
    }

    await updateBlogCover(id, post.coverImageKey, alt.data, user.id);
    invalidateBlogContent();

    return Response.json({ ok: true, alt: alt.data });
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

    const post = await getAdminBlogPost(id);
    if (!post) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    if (post.coverImageKey) {
      // Object first, then the columns: the key lives nowhere else, so clearing
      // the row first would strand the WebP with nothing pointing at it.
      await removeBlogCoverObject(post.coverImageKey);
      await updateBlogCover(id, null, null, user.id);
      invalidateBlogContent();
    }

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
