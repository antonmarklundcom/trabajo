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
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
