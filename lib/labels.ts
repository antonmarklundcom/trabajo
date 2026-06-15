/**
 * Shared slug → display-name resolver for cities and categories.
 *
 * Why this exists: city/category values reach the UI as slugs (e.g. "asuncion",
 * "administracion"). Several surfaces only have the slug at hand (job cards, the
 * home "popular" chips) and were de-slugifying it inline — which dropped the
 * accents ("Asuncion", "Administracion"). This module is the SINGLE source of
 * truth that maps those slugs back to their accented display names.
 *
 * The dictionary is built from the seed JSON, so the WordPress (Phase 2) path
 * resolves a slug to exactly the same label the seed path did. Slugs not present
 * in the dictionary fall back to a humanized form (dashes → spaces, title-case)
 * — graceful, never a raw slug, just without accents we don't know about.
 */

import citiesSeed from './seed/cities.json';
import categoriesSeed from './seed/categories.json';

const cityNames = new Map<string, string>(
  (citiesSeed as { slug: string; name: string }[]).map((c) => [c.slug, c.name]),
);

const categoryNames = new Map<string, string>(
  (categoriesSeed as { slug: string; name: string }[]).map((c) => [c.slug, c.name]),
);

/** Dash/underscore-separated slug → "Title Case" (fallback for unknown slugs). */
function humanize(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Accented display name for a city slug. */
export function cityLabel(slug: string): string {
  if (!slug) return '';
  return cityNames.get(slug) ?? humanize(slug);
}

/** Accented display name for a category slug. */
export function categoryLabel(slug: string): string {
  if (!slug) return '';
  return categoryNames.get(slug) ?? humanize(slug);
}
