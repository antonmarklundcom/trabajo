// npm run alerts:send — the weekly "empleos nuevos" email to job-alert
// subscribers.
//
// Meant to run once a week, from a scheduler or by hand, like
// scripts/employer-digest.ts — and built the same way, for the same reasons:
//
//   - **Dry run is the default.** `--apply` is required to send anything. An
//     email leaves the database and lands in someone's inbox; it is the one
//     side effect a script cannot take back.
//   - **The dry run and the apply run are the same code path** up to the send:
//     same reads, same skip rules, one clock.
//   - **It prints ids and counts, never addresses.**
//
// What goes in an email: listings published since the alert's last successful
// send (or the last JOB_ALERT_FIRST_PERIOD_DAYS for a first one) that match its
// categoría/ciudad, read through lib/data.ts — the public catalogue seam, so
// the visibility predicate decides what exists and nothing unapproved, expired
// or draft can reach an inbox. An alert with no new listings gets no email and
// keeps its window open. last_sent_at is written only after the provider
// accepted the send, so an outage costs a week's delay, never a lost week.
//
// Runs with DATA_SOURCE=db (package.json): against the seed file every
// listing is months old and nobody would get anything.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import {
  JOB_ALERT_MIN_INTERVAL_DAYS,
  alertSkipReason,
  alertWindowStart,
  canStopPaging,
  parseAlertArgs,
  selectNewJobs,
  type AlertSkipReason,
} from '../lib/job-alerts';
import type { Job } from '../lib/types';

const HELP = `
npm run alerts:send -- [--apply] [--verbose]

The weekly job-alert email. Dry run by default: without --apply it reads and
prints how many alerts are due and how many listings each would get, and sends
nothing.

  --apply     Send the emails listed by the dry run, and record them.
  --verbose   Also list every skipped alert, not only the totals per reason.

--apply needs RESEND_API_KEY, EMAIL_FROM and JOB_ALERTS_SECRET (the same value
the site runs with — it is what every unsubscribe link is derived from), and
DATA_SOURCE=db, which the npm script sets.
`;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A runaway walk is a bug, not a big catalogue: 50 pages is ~1,000 listings. */
const MAX_PAGES = 50;

const SKIP_LABELS: Record<AlertSkipReason | 'gone', string> = {
  unconfirmed: 'not confirmed',
  recently_sent: 'already sent within the interval',
  no_new_jobs: 'no new listing for its filter',
  gone: 'unsubscribed during the run',
};

async function main() {
  const { apply, verbose, help, unknown } = parseAlertArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP.trim());
    process.exit(0);
  }
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}\n`);
    console.error(HELP.trim());
    process.exit(1);
  }

  const { jobAlertsSecret } = await import('../lib/job-alert-token');
  const secret = jobAlertsSecret();
  if (apply && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !secret)) {
    // Fail before the first alert. sendEmail() degrades to log-and-skip by
    // design, which is exactly wrong for a job whose only purpose is to send;
    // and without the secret no email could carry a working unsubscribe link.
    console.error('--apply needs RESEND_API_KEY, EMAIL_FROM and JOB_ALERTS_SECRET. Nothing was sent.');
    process.exit(1);
  }
  if (process.env.DATA_SOURCE !== 'db') {
    console.error('DATA_SOURCE must be "db" (npm run alerts:send sets it). The seed catalogue has no new listings.');
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);
  console.log(
    apply
      ? 'Mode:   APPLY — this run sends email.'
      : 'Mode:   DRY RUN — nothing will be sent. Re-run with --apply to send.',
  );

  // One clock for the run: the interval, every window and every stamp.
  const now = new Date();
  console.log(`Now:    ${now.toISOString()}\n`);

  const { getJobs } = await import('../lib/data');
  const { listDueJobAlerts, getJobAlert, markJobAlertSent } = await import('../lib/db/job-alerts');
  const { sendEmail } = await import('../lib/email');
  const { jobAlertDigestMessage } = await import('../lib/emails/job-alerts');
  const { jobAlertToken } = await import('../lib/job-alert-token');

  const alerts = await listDueJobAlerts(new Date(now.getTime() - JOB_ALERT_MIN_INTERVAL_DAYS * DAY_MS));
  console.log(`${alerts.length} confirmed alert(s) not sent anything in the last ${JOB_ALERT_MIN_INTERVAL_DAYS} days.\n`);

  // One catalogue walk per distinct filter, reaching back to the OLDEST window
  // among the alerts that share it; each alert then narrows to its own.
  const oldestSince = new Map<string, Date>();
  const filterKey = (a: { categorySlug: string | null; citySlug: string | null }) =>
    `${a.categorySlug ?? '*'}|${a.citySlug ?? '*'}`;
  for (const alert of alerts) {
    const since = alertWindowStart(alert.lastSentAt, now);
    const key = filterKey(alert);
    const current = oldestSince.get(key);
    if (!current || since < current) oldestSince.set(key, since);
  }

  const catalogue = new Map<string, Job[]>();
  async function jobsFor(categorySlug: string | null, citySlug: string | null): Promise<Job[]> {
    const key = filterKey({ categorySlug, citySlug });
    const cached = catalogue.get(key);
    if (cached) return cached;
    const since = oldestSince.get(key) ?? alertWindowStart(null, now);
    const collected: Job[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { jobs, total } = await getJobs({
        categoria: categorySlug ?? undefined,
        ciudad: citySlug ?? undefined,
        orden: 'recientes',
        page,
      });
      collected.push(...jobs);
      if (collected.length >= total || canStopPaging(jobs, since, now)) break;
    }
    catalogue.set(key, collected);
    return collected;
  }

  const skipped: Record<AlertSkipReason | 'gone', number> = {
    unconfirmed: 0,
    recently_sent: 0,
    no_new_jobs: 0,
    gone: 0,
  };
  let due = 0;
  let sent = 0;
  let failures = 0;

  for (const listed of alerts) {
    const skip = (why: AlertSkipReason | 'gone') => {
      skipped[why] += 1;
      if (verbose) console.log(`  alert ${String(listed.id).padStart(7)}  skip: ${SKIP_LABELS[why]}`);
    };

    try {
      const early = alertSkipReason(listed, now);
      if (early) {
        skip(early);
        continue;
      }

      const since = alertWindowStart(listed.lastSentAt, now);
      const fresh = selectNewJobs(await jobsFor(listed.categorySlug, listed.citySlug), listed, since, now);
      const reason = alertSkipReason(listed, now, fresh.length);
      if (reason) {
        skip(reason);
        continue;
      }

      due += 1;
      console.log(
        `  alert ${String(listed.id).padStart(7)}  ${listed.categorySlug ?? 'todas'} / ${listed.citySlug ?? 'todas'}` +
          `  ${fresh.length} new listing(s) since ${since.toISOString().slice(0, 10)}`,
      );
      if (!apply) continue;

      // The row as it is NOW — an unsubscribe a second ago means no email.
      const alert = await getJobAlert(listed.id);
      if (!alert || !alert.confirmedAt) {
        due -= 1;
        skip('gone');
        continue;
      }

      const result = await sendEmail(
        jobAlertDigestMessage(
          alert.email,
          { categorySlug: alert.categorySlug, citySlug: alert.citySlug },
          // Only the public fields the email type allows (lib/emails/job-alerts.ts AlertJob).
          fresh.map((job) => ({
            slug: job.slug,
            title: job.title,
            company: job.company,
            citySlug: job.citySlug,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryHidden: job.salaryHidden,
          })),
          jobAlertToken(alert.id, alert.email, secret!),
        ),
      );
      if (result.sent) {
        // After the provider accepted it, never before: a failed send leaves
        // the window open, so these listings are still "new" next run.
        await markJobAlertSent(alert.id, now);
        sent += 1;
      } else {
        failures += 1;
        console.error(`          send FAILED (${result.reason}) — NOT recorded; due again on the next run.`);
      }
    } catch (err) {
      failures += 1;
      console.error(
        `  alert ${String(listed.id).padStart(7)}  FAILED — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log('\nSummary');
  console.log('-------');
  console.log(`  due for an email          ${due}`);
  for (const reason of Object.keys(skipped) as (AlertSkipReason | 'gone')[]) {
    console.log(`  skipped: ${SKIP_LABELS[reason].padEnd(34)} ${skipped[reason]}`);
  }
  if (apply) {
    console.log(`  emails sent               ${sent}`);
  } else {
    console.log('\nNothing was sent. Re-run with --apply to send.');
  }

  if (failures > 0) {
    console.error(`\n${failures} alert(s) FAILED. See the errors above.`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
