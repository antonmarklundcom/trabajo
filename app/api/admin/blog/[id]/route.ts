// PATCH /api/admin/blog/[id] — edit an article. DELETE removes it.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogSlugExists, deleteBlogPost, getAdminBlogPost, updateBlogPost } from '@/lib/db/blog';
import { invalidateBlogContent } from '@/lib/cache';
import { slugify, uniqueSlug } from '@/lib/slug';
import { blogPostSchema } from '../schema';

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (id === null) return Response.json({ error: 'Id inválido.' }, { status: 400 });

    const existing = await getAdminBlogPost(id);
    if (!existing) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = blogPostSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    // An image with no alt text is an accessibility defect, and publishing is
    // the moment it stops being fixable in private. The upload route already
    // requires alt text, so this only catches a row that predates it or was
    // edited by hand — cheap, and the failure it prevents is one nobody
    // notices until a screen reader hits it.
    if (data.status === 'published' && existing.coverImageKey && !existing.coverAlt?.trim()) {
      return Response.json(
        { error: 'La portada necesita un texto alternativo antes de publicar.' },
        { status: 400 },
      );
    }

    // A slug change on a PUBLISHED post mints a 301 (lib/db/blog.ts). No
    // confirmation dialog, unlike the job form: there the app had no way to
    // issue the redirect, so the editor had to be told to go and configure one.
    // Here the redirect is part of the same write, so a confirmation step would
    // be asking permission for something already handled.
    let slug = existing.slug;
    const requested = data.slug?.trim();
    if (requested && slugify(requested) !== existing.slug) {
      slug = await uniqueSlug(slugify(requested), (candidate) => blogSlugExists(candidate, id));
    }

    await updateBlogPost(
      id,
      {
        slug,
        title: data.title,
        description: data.description,
        body: data.body,
        category: data.category,
        status: data.status,
        relatedCategorySlug: data.relatedCategory || null,
        relatedCitySlug: data.relatedCity || null,
        publishedAt: data.publishedAt || null,
      },
      user.id,
      { slug: existing.slug, status: existing.status },
    );

    invalidateBlogContent();

    return Response.json({ ok: true, slug, slugChanged: slug !== existing.slug });
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

    const existing = await getAdminBlogPost(id);
    if (!existing) return Response.json({ error: 'Artículo no encontrado.' }, { status: 404 });

    await deleteBlogPost(id, user.id);

    // A deleted article must stop being served immediately — the case where
    // stale-while-revalidate would be actively wrong.
    invalidateBlogContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
