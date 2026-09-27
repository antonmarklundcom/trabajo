// The article payload, shared by POST /api/admin/blog and PATCH
// /api/admin/blog/[id].
//
// One definition rather than the copy-paste the job routes carry: the two blog
// handlers validate exactly the same body, and a limit that drifts between
// create and edit (a 160-character description on create, unbounded on edit)
// is a bug that only shows up in the SERP months later.
import { z } from 'zod';
import { blogCategoryEnum, blogStatusEnum } from '@/lib/db/schema';
import { SLUG_PATTERN } from '@/lib/blog';

export const blogPostSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    // Optional: generated from the title when empty (POST) or left unchanged
    // (PATCH). Validated as a slug so an admin cannot type a URL with a slash
    // in it and have slugify() quietly rewrite it into something else.
    slug: z.string().trim().max(200).optional(),
    // 160 is where Google truncates. Enforced rather than advised, because the
    // whole reason this field is separate from the body is that someone is
    // writing it for the SERP.
    description: z.string().trim().min(50).max(160),
    body: z.string().trim().min(50).max(60000),
    category: z.enum(blogCategoryEnum),
    status: z.enum(blogStatusEnum),
    // Internal-linking targets for the "Empleos relacionados" block and the
    // blog blocks on job pages. Shape here; EXISTENCE in the taxonomy is
    // checked by unknownRelatedTaxonomy() in the handlers (C3), which need the
    // database this schema must not import.
    relatedCategory: z.string().trim().regex(SLUG_PATTERN).max(100).or(z.literal('')).nullish(),
    relatedCity: z.string().trim().regex(SLUG_PATTERN).max(100).or(z.literal('')).nullish(),
    // Editorial date. Left empty on a post being published for the first time,
    // in which case the write layer stamps today in Paraguay
    // (lib/db/blog.ts). A future date on a published post schedules it: the
    // public predicate hides it until that day.
    publishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
      .or(z.literal(''))
      .nullish(),
  })
  // A sector guide IS its job category (PLAN-GROWTH.md §4 C3): it is the
  // article the /trabajo/{cat} landing puts first, found through
  // relatedCategorySlug and nothing else. Without one it is a guide that no
  // landing can ever show.
  .refine((data) => data.category !== 'guias-por-sector' || Boolean(data.relatedCategory), {
    path: ['relatedCategory'],
    message: 'Una guía por sector necesita la categoría de empleos a la que corresponde.',
  });

export type BlogPostPayload = z.infer<typeof blogPostSchema>;

/**
 * The message for a 400. The cross-field rule above is written in Spanish for
 * the editor; zod's own per-field messages are English and generic, so those
 * stay behind the existing "Datos inválidos." (the form already enforces the
 * per-field limits before a request is sent).
 */
export function firstIssueMessage(error: z.ZodError): string {
  const custom = error.issues.find((issue) => issue.code === 'custom');
  return custom?.message ?? 'Datos inválidos.';
}

/**
 * The related slugs that are not in the job taxonomy, as an editor-facing
 * message, or null when both are known (or empty). A slug that names no
 * category matches no jobs and no landing, so the internal link the field
 * exists for would silently never appear.
 */
export function unknownRelatedTaxonomy(
  data: Pick<BlogPostPayload, 'relatedCategory' | 'relatedCity'>,
  known: { categories: ReadonlyArray<{ slug: string }>; cities: ReadonlyArray<{ slug: string }> },
): string | null {
  if (data.relatedCategory && !known.categories.some((c) => c.slug === data.relatedCategory)) {
    return `La categoría de empleos "${data.relatedCategory}" no existe.`;
  }
  if (data.relatedCity && !known.cities.some((c) => c.slug === data.relatedCity)) {
    return `La ciudad "${data.relatedCity}" no existe.`;
  }
  return null;
}
