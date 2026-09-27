// Shared slug helpers for admin-created records (jobs, companies). Mirrors
// scripts/seed-import.ts's slugify() so imported and admin-created slugs look
// the same.

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Appends a numeric suffix until `exists` reports the slug is free.
 * `exists` should exclude the record being edited (pass its id to the query).
 */
/** Leaves room for a `-NNN` suffix inside the narrowest slug column (200). */
export const MAX_SLUG_ROOT = 180;

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  // Capped so the suffix always fits: the narrowest column this writes is
  // varchar(200) (jobs.slug, blog_posts.slug), and a 200-char title used to
  // produce a 200-char root whose "-2" made the INSERT fail.
  const root = slugify(base).slice(0, MAX_SLUG_ROOT).replace(/-+$/, '') || 'item';
  let candidate = root;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
