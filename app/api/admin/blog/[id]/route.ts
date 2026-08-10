import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogSlugExists, deleteBlogPost, getAdminBlogPost, updateBlogPost } from '@/lib/db/blog-admin';
import { blogCategoryEnum } from '@/lib/db/schema';
import { invalidateBlogContent } from '@/lib/cache';
import { slugify, uniqueSlug } from '@/lib/slug';

const postSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().max(200).optional(),
  description: z.string().min(1).max(160),
  category: z.enum(blogCategoryEnum),
  bodyHtml: z.string().min(1).max(200_000),
  featuredImageKey: z.string().max(255).nullable(),
  relatedCategory: z.string().max(255).nullable(),
  relatedCity: z.string().max(255).nullable(),
  published: z.boolean(),
  // Slugs are live SEO URLs (AGENTS.md) once published — same confirmation
  // gate as app/api/admin/empleos/[id]/route.ts.
  confirmSlugChange: z.boolean().optional(),
});

async function loadId(params: Promise<{ id: string }>) {
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
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    let slug = existing.slug;
    const requestedSlug = data.slug?.trim();
    if (requestedSlug && slugify(requestedSlug) !== existing.slug) {
      if (existing.published && !data.confirmSlugChange) {
        return Response.json(
          {
            error:
              'Este artículo está publicado. Cambiar el slug rompe la URL actual — confirmá el cambio y configurá un redirect 301.',
            requiresConfirmation: true,
          },
          { status: 409 },
        );
      }
      slug = await uniqueSlug(slugify(requestedSlug), (candidate) => blogSlugExists(candidate, id));
    }

    await updateBlogPost(id, { ...data, slug }, user.id);

    // A slug change is covered too: '/blog/[slug]' invalidates every article
    // page, so the old URL stops being served from cache as well.
    invalidateBlogContent();

    return Response.json({ ok: true, slug });
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

    await deleteBlogPost(id, user.id);
    invalidateBlogContent();

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
