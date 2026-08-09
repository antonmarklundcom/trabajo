import type { MetadataRoute } from 'next';
import { getJobs, getCategories, getCities } from '@/lib/data';

// Left at an hour on purpose: a new listing reaches the sitemap immediately
// because every admin mutation revalidates '/sitemap.xml' (lib/cache.ts), so
// the timer only has to cover job expiry.
export const revalidate = 3600;

/**
 * getJobs() is paginated (PAGE_SIZE = 20 in both the seed and db seams) — the
 * sitemap needs every published job, not just the first page, so it walks
 * every page. Cheap: this route only runs on the 1h revalidate timer.
 */
async function getAllJobs() {
  const first = await getJobs({ orden: 'recientes', page: 1 });
  const totalPages = Math.ceil(first.total / 20);
  if (totalPages <= 1) return first.jobs;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => getJobs({ orden: 'recientes', page: i + 2 })),
  );
  return [...first.jobs, ...rest.flatMap((page) => page.jobs)];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const [jobs, categories, cities] = await Promise.all([
    getAllJobs(),
    getCategories(),
    getCities(),
  ]);

  // Category/city pairs that actually have a published job — the taxonomy
  // pages already noindex empty combinations (app/trabajo/[categoria]/
  // [ciudad]/page.tsx); the sitemap must not list what it tells crawlers not
  // to index, or it sends Search Console a contradictory signal and wastes
  // crawl budget on thin pages.
  const nonEmptyCombos = new Set(jobs.map((job) => `${job.categorySlug}|${job.citySlug}`));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/empleos`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/publicar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/planes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contacto`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/privacidad`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/terminos`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Job detail pages
  const jobPages: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${siteUrl}/empleos/${job.slug}`,
    lastModified: new Date(job.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Category landing pages (only non-empty)
  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((cat) => (cat.jobCount ?? 0) > 0)
    .map((cat) => ({
      url: `${siteUrl}/trabajo/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  // Category + city landing pages — only combinations with a published job.
  const landingPages: MetadataRoute.Sitemap = [];
  for (const cat of categories) {
    for (const city of cities) {
      if (!nonEmptyCombos.has(`${cat.slug}|${city.slug}`)) continue;
      landingPages.push({
        url: `${siteUrl}/trabajo/${cat.slug}/${city.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      });
    }
  }

  return [...staticPages, ...jobPages, ...categoryPages, ...landingPages];
}
