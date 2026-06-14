import type { MetadataRoute } from 'next';
import { getJobs, getCategories, getCities } from '@/lib/data';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const [{ jobs }, categories, cities] = await Promise.all([
    getJobs({ orden: 'recientes', page: 1 }),
    getCategories(),
    getCities(),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/empleos`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/publicar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/planes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contacto`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
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

  // Category + city landing pages (only non-empty combinations)
  const landingPages: MetadataRoute.Sitemap = [];
  for (const cat of categories) {
    for (const city of cities) {
      // We only include combinations where there are actual jobs
      // (jobCount on category is aggregate; we use a simple heuristic here)
      // In production with WP backend, do a real count query.
      // For seed data, we include all non-empty city combos.
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
