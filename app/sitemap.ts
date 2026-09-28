import type { MetadataRoute } from 'next';
import { getAllPublishedJobSummaries, getCategories, getCities } from '@/lib/data';
import { blogCategoryPath, getBlogCategoryCounts, getBlogPosts } from '@/lib/blog';
import { blogArchivesForSitemap, companiesWithPublicJobs } from '@/lib/seo';

// Left at an hour on purpose: a new listing reaches the sitemap immediately
// because every admin mutation revalidates '/sitemap.xml' (lib/cache.ts), so
// the timer only has to cover job expiry.
export const revalidate = 3600;

// The page walk that used to live here is now getAllPublishedJobSummaries() in
// lib/data.ts: app/empleos/[slug] needs the same list for generateStaticParams,
// and two copies of "every published job" is two things to keep in step.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';

  const [jobs, categories, cities, posts, blogCategoryCounts] = await Promise.all([
    getAllPublishedJobSummaries(),
    getCategories(),
    getCities(),
    getBlogPosts(),
    getBlogCategoryCounts(),
  ]);

  // Category/city pairs that actually have a published job — the taxonomy
  // pages already noindex empty combinations (app/trabajo/[categoria]/
  // [ciudad]/page.tsx); the sitemap must not list what it tells crawlers not
  // to index, or it sends Search Console a contradictory signal and wastes
  // crawl budget on thin pages.
  const nonEmptyCombos = new Set(jobs.map((job) => `${job.categorySlug}|${job.citySlug}`));

  // Real lastModified for a taxonomy page: the latest updatedAt among the
  // jobs it lists, computed from the same walk rather than a second query —
  // `new Date()` on every build told Google every category changed on every
  // crawl, which is exactly the noise a lastModified exists to avoid.
  const latestUpdateByCategory = new Map<string, Date>();
  const latestUpdateByCity = new Map<string, Date>();
  const latestUpdateByCombo = new Map<string, Date>();
  for (const job of jobs) {
    const updated = new Date(job.updatedAt);
    const byCategory = latestUpdateByCategory.get(job.categorySlug);
    if (!byCategory || updated > byCategory) latestUpdateByCategory.set(job.categorySlug, updated);
    const byCity = latestUpdateByCity.get(job.citySlug);
    if (!byCity || updated > byCity) latestUpdateByCity.set(job.citySlug, updated);
    const comboKey = `${job.categorySlug}|${job.citySlug}`;
    const byCombo = latestUpdateByCombo.get(comboKey);
    if (!byCombo || updated > byCombo) latestUpdateByCombo.set(comboKey, updated);
  }

  // Static pages. `lastModified` is OMITTED rather than backfilled with
  // `new Date()` — a page that says "modified right now" on every crawl is a
  // signal that means nothing, and Google is documented to ignore a
  // lastModified it can't trust once it notices the pattern. `/` and
  // `/empleos` are the two exceptions: their content genuinely changes with
  // every admin write (a new or re-approved job), so "now" is honest there.
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/empleos`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/publicar`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/buscar-personal`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/publicar-gratis`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/planes`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contacto`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/terminos`, changeFrequency: 'yearly', priority: 0.3 },
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
      lastModified: latestUpdateByCategory.get(cat.slug),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  // Category + city landing pages — only combinations with a published job.
  const landingPages: MetadataRoute.Sitemap = [];
  for (const cat of categories) {
    for (const city of cities) {
      const comboKey = `${cat.slug}|${city.slug}`;
      if (!nonEmptyCombos.has(comboKey)) continue;
      landingPages.push({
        url: `${siteUrl}/trabajo/${cat.slug}/${city.slug}`,
        lastModified: latestUpdateByCombo.get(comboKey),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      });
    }
  }

  // City landing pages (PLAN-GROWTH.md §4 S4, only non-empty).
  const cityPages: MetadataRoute.Sitemap = cities
    .filter((city) => (city.jobCount ?? 0) > 0)
    .map((city) => ({
      url: `${siteUrl}/trabajo-en/${city.slug}`,
      lastModified: latestUpdateByCity.get(city.slug),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  // Company pages (PLAN-GROWTH.md §4 D5) — only while the company has a
  // public job, derived from the same walk: a company whose listings all
  // expired renders noindex, and is therefore not listed here either.
  const companyPages: MetadataRoute.Sitemap = [...companiesWithPublicJobs(jobs)].map(
    ([companySlug, lastModified]) => ({
      url: `${siteUrl}/empresas/${companySlug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }),
  );

  // Blog category archives (PLAN-GROWTH.md §4 C2) — only the ones with a
  // published post, by the same rule that makes an empty archive noindex
  // (lib/seo.ts blogArchiveRobots()). lastModified is the newest edit among
  // the archive's posts, from the post list already in hand.
  const latestUpdateByBlogCategory = new Map<string, Date>();
  for (const post of posts) {
    const updated = new Date(post.updatedAt);
    const seen = latestUpdateByBlogCategory.get(post.category);
    if (!seen || updated > seen) latestUpdateByBlogCategory.set(post.category, updated);
  }
  const blogArchivePages: MetadataRoute.Sitemap = blogArchivesForSitemap(blogCategoryCounts).map(
    (category) => ({
      url: `${siteUrl}${blogCategoryPath(category)}`,
      lastModified: latestUpdateByBlogCategory.get(category),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }),
  );

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...jobPages,
    ...categoryPages,
    ...cityPages,
    ...landingPages,
    ...companyPages,
    ...blogArchivePages,
    ...blogPages,
  ];
}
