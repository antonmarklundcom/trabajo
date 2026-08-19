// Writes and reads the auth audit trail (PLAN-NEXT.md §2 A1).
//
// One module so that the two things that keep this table safe to have are true
// in one place: a write NEVER throws into the path it is observing, and a
// failure row never carries a full identifier.
import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';

import { authEvents, users, type authEventEnum, type authSurfaceEnum } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

export type AuthSurface = (typeof authSurfaceEnum)[number];
export type AuthEventName = (typeof authEventEnum)[number];

export type AuthEventInput = {
  surface: AuthSurface;
  event: AuthEventName;
  /** Set on staff/employer events. Never together with candidateId. */
  userId?: number | null;
  /** Set on candidate events. */
  candidateId?: number | null;
  /** The submitted address on a failure. Truncated before storage. */
  identifier?: string | null;
  /** From clientIp() — the B1 trusted value, or null. */
  ip: string | null;
};

/**
 * `jose***@gmail.com` → `jos***@gmail.com`, capped.
 *
 * Enough to see one account being hammered; not enough to make this table a
 * harvest of every address anyone ever typed into a login form. The domain is
 * kept because a burst of attempts across one domain is itself the signal.
 */
function identifierHint(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed.slice(0, 3).padEnd(3, '*') + '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  return `${local.slice(0, 3)}***${domain}`.slice(0, 64);
}

/**
 * Records an authentication event. NEVER throws.
 *
 * The swallow is the whole design decision in this function. This is called
 * from inside login, logout and password-reset handlers, and an audit trail
 * that can fail a login is worse than no audit trail: it converts a logging
 * problem — a full disk, a locked table — into an outage of the thing being
 * logged. The same reasoning lib/email.ts uses, for the same reason.
 *
 * It follows that a missing row is possible and this table is evidence, not
 * proof. That is stated here rather than discovered during an incident.
 */
export async function recordAuthEvent(input: AuthEventInput): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(authEvents).values({
      surface: input.surface,
      event: input.event,
      userId: input.userId ?? null,
      candidateId: input.candidateId ?? null,
      identifierHint: input.identifier ? identifierHint(input.identifier) : null,
      ip: input.ip,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[auth-events] failed to record', {
      surface: input.surface,
      event: input.event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export type AuthEventRow = {
  id: number;
  surface: string;
  event: string;
  userId: number | null;
  candidateId: number | null;
  actorName: string | null;
  identifierHint: string | null;
  ip: string | null;
  createdAt: Date;
};

const PAGE_SIZE = 50;

/**
 * The admin read. No filters, no search, no export — deliberately.
 *
 * A "search by email" box here would rebuild the candidate-search capability
 * that AGENTS.md forbids, out of the one table that records every address
 * anyone typed. Paging back through it is enough to investigate an incident.
 */
export async function listAuthEvents(
  page: number,
): Promise<{ rows: AuthEventRow[]; total: number; pageSize: number }> {
  const db = await getDb();
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;

  const rows = await db
    .select({
      id: authEvents.id,
      surface: authEvents.surface,
      event: authEvents.event,
      userId: authEvents.userId,
      candidateId: authEvents.candidateId,
      // Left join: the user row can be gone, the event row is not.
      actorName: users.name,
      identifierHint: authEvents.identifierHint,
      ip: authEvents.ip,
      createdAt: authEvents.createdAt,
    })
    .from(authEvents)
    .leftJoin(users, eq(users.id, authEvents.userId))
    .orderBy(desc(authEvents.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(authEvents);

  return { rows, total: Number(total), pageSize: PAGE_SIZE };
}
