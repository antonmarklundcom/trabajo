// Aggregate-only admin statistics — PLAN-PHASE2.md §5.1/§5.2.
//
// Nothing here returns a name, a phone, an email or a CV. Every query is a
// COUNT/GROUP BY. That is not a convention worth re-deriving per caller: it is
// the property that keeps /admin/estadisticas outside the reason-gated,
// logged path that lib/db/candidates-admin.ts is (§2.4) — an aggregate has no
// data subject to log access against.
//
// Cached with unstable_cache on a fixed 5-minute window rather than per
// request: these are GROUP BY scans over the whole applications/jobs tables
// and this repo runs on an 8-connection pool (PLAN-PHASE2.md §5.2). A stats
// dashboard being up to 5 minutes stale is the correct trade, not a bug.
import 'server-only';

import { unstable_cache } from 'next/cache';
import { and, count, desc, eq, gte, isNull, isNotNull, sql } from 'drizzle-orm';

import {
  applications,
  candidates,
  categories,
  cities,
  companies,
  jobs,
} from './schema';

async function getDb() {
  return (await import('./index')).db;
}

const STATS_TTL_SECONDS = 300;

function weeksAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d;
}

export type HeadlineCounts = {
  totalApplications: number;
  applicationsLast30d: number;
  registeredApplications: number;
  anonymousApplications: number;
  totalCandidates: number;
  activeCandidates30d: number;
  publishedJobs: number;
  jobsWithZeroApplications: number;
  featuredJobsActive: number;
};

async function computeHeadlineCounts(): Promise<HeadlineCounts> {
  const db = await getDb();
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ n: totalApplications }],
    [{ n: applicationsLast30d }],
    [{ n: registeredApplications }],
    [{ n: anonymousApplications }],
    [{ n: totalCandidates }],
    [{ n: activeCandidates30d }],
    [{ n: publishedJobs }],
    [{ n: featuredJobsActive }],
    jobsWithApplications,
  ] = await Promise.all([
    db.select({ n: count() }).from(applications),
    db.select({ n: count() }).from(applications).where(gte(applications.createdAt, since30d)),
    db.select({ n: count() }).from(applications).where(isNotNull(applications.candidateId)),
    db.select({ n: count() }).from(applications).where(isNull(applications.candidateId)),
    db.select({ n: count() }).from(candidates),
    db.select({ n: count() }).from(candidates).where(gte(candidates.lastLoginAt, since30d)),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'published')),
    db
      .select({ n: count() })
      .from(jobs)
      .where(and(eq(jobs.status, 'published'), gte(jobs.featuredUntil, now))),
    db
      .select({ jobId: applications.jobId })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(jobs.status, 'published'))
      .groupBy(applications.jobId),
  ]);

  return {
    totalApplications,
    applicationsLast30d,
    registeredApplications,
    anonymousApplications,
    totalCandidates,
    activeCandidates30d,
    publishedJobs,
    jobsWithZeroApplications: Math.max(0, publishedJobs - jobsWithApplications.length),
    featuredJobsActive,
  };
}

export const getHeadlineCounts = unstable_cache(computeHeadlineCounts, ['stats-headline'], {
  revalidate: STATS_TTL_SECONDS,
});

export type WeeklyPoint = { weekStart: string; count: number };

async function computeApplicationsPerWeek(): Promise<WeeklyPoint[]> {
  const db = await getDb();
  const since = weeksAgo(8);
  const rows = await db
    .select({
      weekStart: sql<string>`DATE(DATE_SUB(${applications.createdAt}, INTERVAL WEEKDAY(${applications.createdAt}) DAY))`,
      n: count(),
    })
    .from(applications)
    .where(gte(applications.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ weekStart: r.weekStart, count: r.n }));
}

export const getApplicationsPerWeek = unstable_cache(
  computeApplicationsPerWeek,
  ['stats-applications-weekly'],
  { revalidate: STATS_TTL_SECONDS },
);

async function computeCandidateSignupsPerWeek(): Promise<WeeklyPoint[]> {
  const db = await getDb();
  const since = weeksAgo(8);
  const rows = await db
    .select({
      weekStart: sql<string>`DATE(DATE_SUB(${candidates.createdAt}, INTERVAL WEEKDAY(${candidates.createdAt}) DAY))`,
      n: count(),
    })
    .from(candidates)
    .where(gte(candidates.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ weekStart: r.weekStart, count: r.n }));
}

export const getCandidateSignupsPerWeek = unstable_cache(
  computeCandidateSignupsPerWeek,
  ['stats-signups-weekly'],
  { revalidate: STATS_TTL_SECONDS },
);

export type LabeledCount = { label: string; count: number };

async function computeApplicationsByCategory(): Promise<LabeledCount[]> {
  const db = await getDb();
  const rows = await db
    .select({ label: categories.name, n: count() })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(categories, eq(jobs.categoryId, categories.id))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(count()))
    .limit(10);
  return rows.map((r) => ({ label: r.label, count: r.n }));
}

export const getApplicationsByCategory = unstable_cache(
  computeApplicationsByCategory,
  ['stats-by-category'],
  { revalidate: STATS_TTL_SECONDS },
);

async function computeApplicationsByCity(): Promise<LabeledCount[]> {
  const db = await getDb();
  const rows = await db
    .select({ label: cities.name, n: count() })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(cities, eq(jobs.cityId, cities.id))
    .groupBy(cities.id, cities.name)
    .orderBy(desc(count()))
    .limit(10);
  return rows.map((r) => ({ label: r.label, count: r.n }));
}

export const getApplicationsByCity = unstable_cache(computeApplicationsByCity, ['stats-by-city'], {
  revalidate: STATS_TTL_SECONDS,
});

export type FunnelCounts = Record<string, number>;

async function computeApplicationFunnel(): Promise<FunnelCounts> {
  const db = await getDb();
  const rows = await db
    .select({ status: applications.status, n: count() })
    .from(applications)
    .groupBy(applications.status);
  const out: FunnelCounts = { new: 0, reviewed: 0, contacted: 0, discarded: 0, hired: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export const getApplicationFunnel = unstable_cache(computeApplicationFunnel, ['stats-funnel'], {
  revalidate: STATS_TTL_SECONDS,
});

export type EmployerActivityRow = {
  companyId: number;
  companyName: string;
  jobsPosted: number;
  applicationsReceived: number;
};

async function computeEmployerActivity(): Promise<EmployerActivityRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      jobsPosted: sql<number>`COUNT(DISTINCT ${jobs.id})`,
      applicationsReceived: sql<number>`COUNT(${applications.id})`,
    })
    .from(companies)
    .leftJoin(jobs, eq(jobs.companyId, companies.id))
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .groupBy(companies.id, companies.name)
    .orderBy(desc(sql`COUNT(${applications.id})`))
    .limit(20);
  return rows;
}

export const getEmployerActivity = unstable_cache(computeEmployerActivity, ['stats-employer-activity'], {
  revalidate: STATS_TTL_SECONDS,
});
