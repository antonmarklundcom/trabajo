// Admin-side reads and mutations for /admin/* and /api/admin/*.
//
// Deliberately separate from lib/db/queries.ts: that file is the public read
// path and its visiblePredicate() must never be near admin code that needs to
// see draft/pending/rejected/archived jobs and inactive users too
// (ARCHITECTURE.md §3/§4, AGENTS.md — public reads go through the single
// visibility predicate).
//
// `db` is imported lazily (like lib/auth.ts's getDb()): lib/db/index.ts opens
// its connection pool at module-evaluation time, and this module is reachable
// from /admin's route tree even when DATA_SOURCE=seed and DATABASE_URL is
// unset — a static import would break `next build`'s page-data collection
// for the public site.
import 'server-only';

import { desc, eq, count } from 'drizzle-orm';
import { activityLog, companies, jobs, users } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const db = await getDb();
  const [[pending], [published], [totalCompanies], recent] = await Promise.all([
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'pending')),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'published')),
    db.select({ n: count() }).from(companies),
    db
      .select({
        id: activityLog.id,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        action: activityLog.action,
        createdAt: activityLog.createdAt,
        actorName: users.name,
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.actorUserId, users.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(10),
  ]);

  return {
    pendingCount: pending.n,
    publishedCount: published.n,
    companyCount: totalCompanies.n,
    recentActivity: recent,
  };
}
