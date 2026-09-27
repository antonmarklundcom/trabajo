// contact_messages — the /contacto inbox (lead type `contact`).
//
// Written by POST /api/v1/leads before the webhook fan-out, so a message
// exists somewhere we control whether or not GHL, Sheets or the team inbox
// accept it. Read by /admin/mensajes, which is admin + editor.
//
// Not candidate data: a contact message is someone writing to the portal team,
// with no candidate_id and no application behind it, so it is outside
// AGENTS.md's candidates-admin.ts rule and its reads are not written to
// data_access_logs. /privacidad §6 promises logging of staff access to
// postulante data only; logging these would need that copy to say so first.
//
// Retention (lib/retention.ts CONTACT_MESSAGE_RETENTION_MONTHS) is a hard
// DELETE in lib/db/retention.ts — nothing here deletes.
//
// `db` is imported lazily, like lib/db/admin.ts, so /admin's route tree still
// builds with DATA_SOURCE=seed and no DATABASE_URL.
import 'server-only';

import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { contactMessages, users } from './schema';

async function getDb() {
  return (await import('./index')).db;
}

/** Matches the varchar(300) column; the value can come from the Referer header. */
const SOURCE_PAGE_MAX = 300;

export type NewContactMessage = {
  name: string;
  phone: string;
  email: string | null;
  message: string;
  sourcePage: string | null;
};

/** Inserts one message and returns its id. Throws on a DB failure — the caller decides. */
export async function createContactMessage(input: NewContactMessage): Promise<number> {
  const db = await getDb();
  const [result] = await db.insert(contactMessages).values({
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    message: input.message,
    sourcePage: input.sourcePage ? input.sourcePage.slice(0, SOURCE_PAGE_MAX) : null,
    createdAt: new Date(),
  });
  return result.insertId;
}

export type AdminContactMessage = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  sourcePage: string | null;
  createdAt: Date;
  handledAt: Date | null;
  handledByUserId: number | null;
  /** The staff member who marked it; null if unhandled or the user row is gone. */
  handledByName: string | null;
};

export type ContactMessageFilter = 'pending' | 'all';

export const CONTACT_MESSAGES_PAGE_SIZE = 25;

/** Newest first. `pending` = not yet marked as handled. */
export async function listContactMessages(
  filter: ContactMessageFilter,
  page: number,
): Promise<{ messages: AdminContactMessage[]; total: number; pageSize: number }> {
  const db = await getDb();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const where = filter === 'pending' ? isNull(contactMessages.handledAt) : undefined;

  const [messages, [{ total }]] = await Promise.all([
    db
      .select({
        id: contactMessages.id,
        name: contactMessages.name,
        phone: contactMessages.phone,
        email: contactMessages.email,
        message: contactMessages.message,
        sourcePage: contactMessages.sourcePage,
        createdAt: contactMessages.createdAt,
        handledAt: contactMessages.handledAt,
        handledByUserId: contactMessages.handledByUserId,
        handledByName: users.name,
      })
      .from(contactMessages)
      .leftJoin(users, eq(users.id, contactMessages.handledByUserId))
      .where(where)
      .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
      .limit(CONTACT_MESSAGES_PAGE_SIZE)
      .offset((safePage - 1) * CONTACT_MESSAGES_PAGE_SIZE),
    db.select({ total: count() }).from(contactMessages).where(where),
  ]);

  return { messages, total, pageSize: CONTACT_MESSAGES_PAGE_SIZE };
}

export async function countUnhandledContactMessages(): Promise<number> {
  const db = await getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(contactMessages)
    .where(isNull(contactMessages.handledAt));
  return total;
}

/**
 * Stamps handled_at/handled_by once. Returns false when the id does not exist
 * or was already handled — the first person to mark it keeps the credit, and a
 * double click is not a second write.
 */
export async function markContactMessageHandled(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  const [result] = await db
    .update(contactMessages)
    .set({ handledAt: new Date(), handledByUserId: userId })
    .where(and(eq(contactMessages.id, id), isNull(contactMessages.handledAt)));
  return result.affectedRows > 0;
}
