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

export const blogPostSchema = z.object({
  title: z.string().trim().min(3).max(255),
  // Optional: generated from the title when empty (POST) or left unchanged
  // (PATCH). Validated as a slug so an admin cannot type a URL with a slash in
  // it and have slugify() quietly rewrite it into something else.
  slug: z.string().trim().max(200).optional(),
  // 160 is where Google truncates. Enforced rather than advised, because the
  // whole reason this field is separate from the body is that someone is
  // writing it for the SERP.
  description: z.string().trim().min(50).max(160),
  body: z.string().trim().min(50).max(60000),
  category: z.enum(blogCategoryEnum),
  status: z.enum(blogStatusEnum),
  // Internal-linking targets for the "Empleos relacionados" block. Slugs of an
  // existing category/city; an unknown one simply matches no jobs and the
  // block is omitted, so this is shape validation, not existence validation.
  relatedCategory: z.string().trim().regex(SLUG_PATTERN).max(100).or(z.literal('')).nullish(),
  relatedCity: z.string().trim().regex(SLUG_PATTERN).max(100).or(z.literal('')).nullish(),
  // Editorial date. Left empty on a post being published for the first time,
  // in which case the write layer stamps today (lib/db/blog.ts).
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
    .or(z.literal(''))
    .nullish(),
});

export type BlogPostPayload = z.infer<typeof blogPostSchema>;
