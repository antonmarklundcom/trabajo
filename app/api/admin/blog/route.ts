import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { blogSlugExists, createBlogPost } from '@/lib/db/blog-admin';
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
});

export async function POST(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const body = await request.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    const slugBase = data.slug?.trim() || data.title;
    const slug = await uniqueSlug(slugify(slugBase), (candidate) => blogSlugExists(candidate));

    const id = await createBlogPost({ ...data, slug }, user.id);
    invalidateBlogContent();
    return Response.json({ id, slug }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
