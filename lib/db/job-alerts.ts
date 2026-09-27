// job_alerts reads and writes — "Avisame de empleos nuevos".
//
// The rules this module exists to hold in one place (scripts/verify-alerts.ts
// asserts each from source):
//
//   - Subscribing writes the alert row AND its consents row in ONE transaction.
//     There is no state in which an alert exists without the record of what
//     was agreed to, or the reverse.
//   - Unsubscribing is a hard DELETE of the alert row plus an appended
//     granted=false consents row, again in one transaction. Consents are never
//     UPDATEd (AGENTS.md: append-only), and the alert is never flagged instead
//     of deleted (AGENTS.md: no soft-delete flags).
//   - Only sha256 hashes of link tokens are written or compared. The raw token
//     is derived in lib/job-alert-token.ts and leaves this module only as the
//     return value that goes into an email.
//
// Every read here is of this table alone. The JOBS an alert lists are read
// through lib/data.ts by the sender, never from here — that is what keeps the
// visibility predicate the only door to the public catalogue.
import 'server-only';

import { and, asc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';

import { consents, jobAlerts } from './schema';
import {
  JOB_ALERTS_PER_EMAIL_MAX,
  JOB_ALERT_RESEND_MINUTES,
  normalizeAlertEmail,
} from '../job-alerts';
import { hashJobAlertToken, jobAlertToken, placeholderTokenHash } from '../job-alert-token';

async function getDb() {
  return (await import('./index')).db;
}

/** consents.user_agent is varchar(255); a longer header must not fail the INSERT under strict mode. */
function fitUserAgent(ua: string | null): string | null {
  return ua ? ua.slice(0, 255) : null;
}

/** MySQL DATETIME keeps whole seconds; so does every timestamp this module writes. */
function wholeSeconds(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export type SubscribeInput = {
  email: string;
  categorySlug: string | null;
  citySlug: string | null;
  ip: string | null;
  userAgent: string | null;
  /** JOB_ALERTS_SECRET, already checked by the caller (lib/flags.ts). */
  secret: string;
};

/**
 * `send`   — mail the confirmation link in `token` (a new alert, or a re-send
 *            for one still unconfirmed), then call markConfirmationSent().
 * `silent` — do nothing more, but answer the visitor exactly as for `send`:
 *            already confirmed, re-sent too recently, or the address is at its
 *            cap. The response must not tell a stranger which.
 */
export type SubscribeResult =
  | { action: 'send'; alertId: number; token: string; created: boolean }
  | { action: 'silent'; reason: 'already_confirmed' | 'resent_recently' | 'address_cap' };

export async function subscribeJobAlert(input: SubscribeInput): Promise<SubscribeResult> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();
  const email = normalizeAlertEmail(input.email);
  const now = wholeSeconds(new Date());

  const existing = await db
    .select({
      id: jobAlerts.id,
      categorySlug: jobAlerts.categorySlug,
      citySlug: jobAlerts.citySlug,
      confirmedAt: jobAlerts.confirmedAt,
      confirmationSentAt: jobAlerts.confirmationSentAt,
    })
    .from(jobAlerts)
    .where(eq(jobAlerts.email, email));

  const same = existing.find(
    (row) => row.categorySlug === input.categorySlug && row.citySlug === input.citySlug,
  );
  if (same) {
    if (same.confirmedAt) return { action: 'silent', reason: 'already_confirmed' };
    const resendAfter = JOB_ALERT_RESEND_MINUTES * 60 * 1000;
    if (same.confirmationSentAt && now.getTime() - same.confirmationSentAt.getTime() < resendAfter) {
      return { action: 'silent', reason: 'resent_recently' };
    }
    // Same row, same derived token: the link in the lost email and the one in
    // this re-send are the same link. No new consent row — nothing new was
    // agreed to, and the original row already records the subscribe.
    return { action: 'send', alertId: same.id, token: jobAlertToken(same.id, email, input.secret), created: false };
  }

  if (existing.length >= JOB_ALERTS_PER_EMAIL_MAX) return { action: 'silent', reason: 'address_cap' };

  // Two submissions racing past the read above can both insert, leaving two
  // identical alerts. Accepted: the worst case is one duplicate weekly email
  // until the person unsubscribes from one of them, and a UNIQUE index cannot
  // express "(email, category, city) with NULLs equal" in MySQL.
  const alertId = await db.transaction(async (tx) => {
    // The token is derived from the id, which only the INSERT yields — so the
    // row goes in with a placeholder hash and gets its real one before COMMIT.
    const [inserted] = await tx.insert(jobAlerts).values({
      email,
      categorySlug: input.categorySlug,
      citySlug: input.citySlug,
      tokenHash: placeholderTokenHash(),
      confirmedAt: null,
      confirmationSentAt: null,
      lastSentAt: null,
      createdAt: now,
    });
    const id = inserted.insertId;

    await tx
      .update(jobAlerts)
      .set({ tokenHash: hashJobAlertToken(jobAlertToken(id, email, input.secret)) })
      .where(eq(jobAlerts.id, id));

    await tx.insert(consents).values({
      subjectType: 'job_alert',
      subjectId: id,
      purpose: 'job_alerts',
      granted: true,
      policyVersion: POLICY_VERSION,
      relatedCompanyId: null,
      relatedJobId: null,
      ip: input.ip,
      userAgent: fitUserAgent(input.userAgent),
      createdAt: now,
    });

    return id;
  });

  return { action: 'send', alertId, token: jobAlertToken(alertId, email, input.secret), created: true };
}

/** Stamped after the confirmation email was accepted by the provider — the re-send throttle's clock. */
export async function markConfirmationSent(alertId: number, at: Date): Promise<void> {
  const db = await getDb();
  await db
    .update(jobAlerts)
    .set({ confirmationSentAt: wholeSeconds(at) })
    .where(eq(jobAlerts.id, alertId));
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export type ConfirmResult =
  | { ok: true; categorySlug: string | null; citySlug: string | null; already: boolean }
  | { ok: false };

/**
 * Called from POST only. The GET page renders a button and nothing else, so a
 * mail scanner that prefetches the link confirms nothing.
 */
export async function confirmJobAlert(rawToken: string): Promise<ConfirmResult> {
  const db = await getDb();
  const tokenHash = hashJobAlertToken(rawToken);

  const [row] = await db
    .select({
      id: jobAlerts.id,
      categorySlug: jobAlerts.categorySlug,
      citySlug: jobAlerts.citySlug,
      confirmedAt: jobAlerts.confirmedAt,
    })
    .from(jobAlerts)
    .where(eq(jobAlerts.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { ok: false };

  if (!row.confirmedAt) {
    await db
      .update(jobAlerts)
      .set({ confirmedAt: wholeSeconds(new Date()) })
      .where(and(eq(jobAlerts.id, row.id), isNull(jobAlerts.confirmedAt)));
  }
  return { ok: true, categorySlug: row.categorySlug, citySlug: row.citySlug, already: row.confirmedAt !== null };
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

/**
 * Hard DELETE of the alert, plus the consents row that records the end of it.
 *
 * Returns false for a token that matches nothing — already unsubscribed,
 * swept, or never valid. The caller answers those alike: "you are not
 * subscribed" is the true state in all three.
 */
export async function unsubscribeJobAlert(
  rawToken: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<boolean> {
  const { POLICY_VERSION } = await import('../policy');
  const db = await getDb();
  const tokenHash = hashJobAlertToken(rawToken);
  const now = wholeSeconds(new Date());

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: jobAlerts.id })
      .from(jobAlerts)
      .where(eq(jobAlerts.tokenHash, tokenHash))
      .limit(1);
    if (!row) return false;

    const [deleted] = await tx.delete(jobAlerts).where(eq(jobAlerts.id, row.id));
    // A concurrent unsubscribe (a double click, or the mail client's one-click
    // POST landing beside the page's) already removed it and wrote its row.
    if (deleted.affectedRows === 0) return false;

    // Append-only: the withdrawal is a NEW row. The subscribe row stays as
    // the evidence of what was agreed to and when.
    await tx.insert(consents).values({
      subjectType: 'job_alert',
      subjectId: row.id,
      purpose: 'job_alerts',
      granted: false,
      policyVersion: POLICY_VERSION,
      relatedCompanyId: null,
      relatedJobId: null,
      ip: meta.ip,
      userAgent: fitUserAgent(meta.userAgent),
      createdAt: now,
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// The weekly sender (scripts/job-alerts.ts)
// ---------------------------------------------------------------------------

export type DueJobAlert = {
  id: number;
  email: string;
  categorySlug: string | null;
  citySlug: string | null;
  confirmedAt: Date | null;
  lastSentAt: Date | null;
};

const dueColumns = {
  id: jobAlerts.id,
  email: jobAlerts.email,
  categorySlug: jobAlerts.categorySlug,
  citySlug: jobAlerts.citySlug,
  confirmedAt: jobAlerts.confirmedAt,
  lastSentAt: jobAlerts.lastSentAt,
};

/** Confirmed alerts not sent anything since `sentBefore`. Unconfirmed rows are never selected. */
export async function listDueJobAlerts(sentBefore: Date): Promise<DueJobAlert[]> {
  const db = await getDb();
  return db
    .select(dueColumns)
    .from(jobAlerts)
    .where(
      and(
        isNotNull(jobAlerts.confirmedAt),
        or(isNull(jobAlerts.lastSentAt), lt(jobAlerts.lastSentAt, sentBefore)),
      ),
    )
    .orderBy(asc(jobAlerts.id));
}

/** The row as it is NOW — an unsubscribe a second ago means no email. */
export async function getJobAlert(id: number): Promise<DueJobAlert | null> {
  const db = await getDb();
  const [row] = await db.select(dueColumns).from(jobAlerts).where(eq(jobAlerts.id, id)).limit(1);
  return row ?? null;
}

/** Written only after the provider accepted the send. */
export async function markJobAlertSent(id: number, at: Date): Promise<void> {
  const db = await getDb();
  await db
    .update(jobAlerts)
    .set({ lastSentAt: wholeSeconds(at) })
    .where(eq(jobAlerts.id, id));
}
