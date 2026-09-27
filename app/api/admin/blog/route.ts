// POST /api/admin/blog — create an article.
//
// Authorization is checked here, server-side, on every call (AGENTS.md): the
// nav link and the pages are UX. Same role set as jobs — admin and editor —
// because a blog post is editorial content, not candidate data.
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogSlugExists, createBlogPost } from '@/lib/db/blog';
import { invalidateBlogContent } from '@/lib/cache';
import { slugify, uniqueSlug } from '@/lib/slug';
import { listCategoryOptions, listCityOptions } from '@/lib/db/taxonomy';
import { blogPostSchema, firstIssueMessage, unknownRelatedTaxonomy } from './schema';

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = blogPostSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: firstIssueMessage(parsed.error), issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const [categories, cities] = await Promise.all([listCategoryOptions(), listCityOptions()]);
    const unknown = unknownRelatedTaxonomy(data, { categories, cities });
    if (unknown) return Response.json({ error: unknown }, { status: 400 });

    // uniqueSlug() also steps over retired slugs, not just live posts — see
    // blogSlugExists(). A new article must not claim a URL that already 301s
    // somewhere else.
    const slug = await uniqueSlug(slugify(data.slug?.trim() || data.title), (candidate) =>
      blogSlugExists(candidate),
    );

    const id = await createBlogPost(
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
    );

    invalidateBlogContent();

    return Response.json({ ok: true, id, slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
