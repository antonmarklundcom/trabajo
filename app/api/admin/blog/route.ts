import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogPostInputSchema } from '@/lib/blog';
import { blogSlugCollides, blogSlugExists, createBlogPost } from '@/lib/db/blog';
import { invalidateBlogContent } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = blogPostInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (await blogSlugExists(data.slug)) {
      return Response.json({ error: 'Ya existe un artículo con ese slug.' }, { status: 409 });
    }
    // §12.6 item 6: a blog slug must not collide with a top-level route
    // segment or an existing job slug.
    if (await blogSlugCollides(data.slug)) {
      return Response.json(
        { error: 'Ese slug choca con una ruta existente del sitio. Elegí otro.' },
        { status: 409 },
      );
    }

    // A new post has no cover yet — it is attached afterward through
    // /api/admin/blog/[id]/portada, which enforces coverAlt itself.
    const id = await createBlogPost(
      {
        slug: data.slug,
        title: data.title,
        description: data.description,
        category: data.category,
        body: data.body,
        coverImageKey: null,
        coverAlt: null,
        coverWidth: null,
        coverHeight: null,
        status: data.status,
        relatedCategory: data.relatedCategory || null,
        relatedCity: data.relatedCity || null,
      },
      user.id,
    );

    if (data.status === 'published') invalidateBlogContent();

    return Response.json({ ok: true, id, slug: data.slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
