// Operational state: facts about running the site, not about its content
// (PLAN-NEXT.md §3 O2).
import 'server-only';

import { eq } from 'drizzle-orm';

import { opsState } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

/** The one key this table holds today. */
export const LAST_PURGE_RUN = 'last_purge_run';

/**
 * How old the last purge may be before /admin calls it out.
 *
 * 35 rather than 30: the sweep is a monthly chore a person does by hand, and a
 * card that turns red because someone ran it on the 3rd instead of the 1st
 * trains its reader to ignore it. 35 days is late by any reading of "monthly".
 */
export const PURGE_STALE_AFTER_DAYS = 35;

async function setState(key: string, value: string): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(opsState)
    .values({ stateKey: key, value, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: now } });
}

async function getState(key: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ value: opsState.value })
    .from(opsState)
    .where(eq(opsState.stateKey, key))
    .limit(1);
  return row?.value ?? null;
}

/**
 * Stamps a COMPLETED purge run.
 *
 * Called only after `--apply` finished with no failed deletions. A run that
 * left candidates in place has not completed, and stamping it would make the
 * panel report the one thing it exists to contradict — that the sweep is
 * current when it is not.
 */
export async function recordPurgeRun(at: Date): Promise<void> {
  await setState(LAST_PURGE_RUN, at.toISOString());
}

/** When the purge last completed, or null if it never has. */
export async function getLastPurgeRun(): Promise<Date | null> {
  const raw = await getState(LAST_PURGE_RUN);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Whole days since the last completed purge; null when there has never been one. */
export function daysSince(at: Date | null, now = new Date()): number | null {
  if (!at) return null;
  return Math.floor((now.getTime() - at.getTime()) / 86_400_000);
}
