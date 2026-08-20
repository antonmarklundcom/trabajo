// The notification senders (PLAN-NEXT.md §3 N1–N3).
//
// One module because these all share the same three properties, and all three
// are easy to lose one route at a time:
//
//   1. **A notification never fails the action that triggered it.** Every
//      function here returns void and swallows its own errors. lib/email.ts
//      already promises `sendEmail()` will not throw, but the lookups around it
//      can — a job row that vanished between the insert and the send is not a
//      reason to 500 a submission that already succeeded.
//   2. **Called from an `after()` block**, never inline, so the visitor's
//      response is not waiting on an HTTP round trip to a mail provider. That
//      is the caller's job; these functions are written to be safe there.
//   3. **Copy lives in lib/emails/**, not here and not in a route.
//
// Job details are read through lib/data.ts, the public catalog seam
// (AGENTS.md) — a notification is not a reason to reach past it.
import 'server-only';

import { getJob } from './data';
import { sendEmail } from './email';
import { listEmployerNotificationRecipients } from './db/employer';
import { applicationReceivedMessage } from './emails/candidate';
import { newApplicationMessage } from './emails/employer';

/**
 * "Recibimos tu postulación" to the applicant (N1).
 *
 * Both application paths call this: the anonymous lead form and the one-click
 * candidate apply. The anonymous form's email field is optional, so the caller
 * passes what it has and this returns quietly when there is nothing to send to.
 */
export async function notifyApplicantOfApplication(params: {
  email: string | null | undefined;
  name: string | null | undefined;
  jobSlug: string;
}): Promise<void> {
  try {
    const { email, name, jobSlug } = params;
    if (!email) return;

    const job = await getJob(jobSlug);
    if (!job) {
      // Unpublished or deleted between the insert and this call. The
      // application is real; we simply cannot name the posting, and an email
      // that says "tu postulación a undefined" is worse than none.
      console.warn('[notify] application confirmation skipped — job not found', { jobSlug });
      return;
    }

    await sendEmail(applicationReceivedMessage(email, name ?? null, job.title, job.company));
  } catch (err) {
    console.error('[notify] application confirmation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * "Nueva postulación" to the company's employer users (N2).
 *
 * Every ACTIVE employer user of the company, or nobody when the company has
 * turned the notification off — both decided by
 * `listEmployerNotificationRecipients()`, so this function cannot forget the
 * toggle. `companyId` comes from the write that just happened rather than from
 * a fresh lookup: the insert already read the job row.
 *
 * Sends are sequential and independent. A company has a handful of users at
 * most (invitation-only, PLAN-PHASE2.md §8 Q2), and one address bouncing must
 * not stop the next one — `sendEmail()` already returns rather than throws, so
 * "independent" costs nothing to guarantee.
 */
export async function notifyEmployerOfApplication(params: {
  companyId: number;
  jobSlug: string;
}): Promise<void> {
  try {
    const { companyId, jobSlug } = params;

    const recipients = await listEmployerNotificationRecipients(companyId);
    if (recipients.length === 0) return;

    const job = await getJob(jobSlug);
    if (!job) {
      console.warn('[notify] employer notification skipped — job not found', { jobSlug });
      return;
    }

    for (const recipient of recipients) {
      await sendEmail(newApplicationMessage(recipient.email, recipient.name, job.title));
    }
  } catch (err) {
    console.error('[notify] employer notification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
