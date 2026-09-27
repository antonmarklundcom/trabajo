// npm run digest:employers — the weekly "Resumen semanal" to employers.
//
// Meant to run once a week (DEPLOY.md §"npm run digest:employers"), from a
// scheduler or by hand. Modelled on scripts/db-purge.ts, and for the same
// reasons:
//
//   - **Dry run is the default.** `--apply` is required to send anything. An
//     email is the one side effect a script cannot take back — it leaves the
//     database and lands in someone's inbox — so the harmless run has to be
//     the one you get by accident.
//   - **The dry run and the apply run are the same code path** up to the send:
//     same reads, same skip rules, one clock. The list you read is the list
//     that gets mailed.
//   - **It prints counts, never content.** Company ids and public names, how
//     many listings, how many recipients. No recipient address, and — by
//     construction of the data, see lib/employer-digest.ts — nothing about an
//     applicant exists here to print.
//
// Idempotency. A company is skipped when it opted out, has no public listing,
// has no active employer user, or was sent a summary less than
// DIGEST_MIN_INTERVAL_DAYS ago. The stamp that makes the last rule work
// (`companies.last_digest_sent_at`) and the view snapshot that makes "visitas
// esta semana" a delta are written together, and ONLY after a send succeeded:
// a provider outage leaves the company due on the next run with nothing lost.
//
// One company failing never stops the others; the exit code is non-zero if any
// did, so a scheduled run does not look green.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import {
  digestCompanySkipReason,
  digestSkipReason,
  parseDigestArgs,
  type DigestSkipReason,
} from '../lib/employer-digest';

const HELP = `
npm run digest:employers -- [--apply] [--verbose]

The weekly employer summary. Dry run by default: without --apply it reads and
prints who would get a summary, and sends nothing.

  --apply     Send the summaries listed by the dry run, and record them.
  --verbose   Also list every skipped company, not only the totals per reason.

--apply needs RESEND_API_KEY and EMAIL_FROM set: without them lib/email.ts
skips every send, and the script refuses to start rather than report a week
of failures.
`;

const SKIP_LABELS: Record<DigestSkipReason, string> = {
  opted_out: 'turned the summary off',
  recently_sent: 'already sent within the interval',
  no_public_listings: 'no public listing right now',
  no_recipients: 'no active employer user',
};

async function main() {
  const { apply, verbose, help, unknown } = parseDigestArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP.trim());
    process.exit(0);
  }
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}\n`);
    console.error(HELP.trim());
    process.exit(1);
  }

  if (apply && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    // Fail before the first company, not after forty "not_configured" results.
    // sendEmail() degrades to log-and-skip by design (the web app must not 500
    // on a missing key), which is exactly wrong for a job whose only purpose
    // is to send.
    console.error('--apply needs RESEND_API_KEY and EMAIL_FROM. Neither send nor stamp happened.');
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);
  console.log(
    apply
      ? 'Mode:   APPLY — this run sends email.'
      : 'Mode:   DRY RUN — nothing will be sent. Re-run with --apply to send.',
  );

  // One clock for the whole run: the skip window, the application period and
  // every "vence pronto / destacado" decision in the emails use this instant.
  const now = new Date();
  console.log(`Now:    ${now.toISOString()}\n`);

  const { listDigestCompanies } = await import('../lib/db/employer-digest');
  const { getEmployerDigest, listEmployerDigestRecipients, recordEmployerDigestSent } = await import(
    '../lib/db/employer'
  );
  const { sendEmail } = await import('../lib/email');
  const { employerWeeklyDigestMessage } = await import('../lib/emails/employer');

  const companies = await listDigestCompanies();
  console.log(`${companies.length} company(ies) with an active employer user.\n`);

  const skipped: Record<DigestSkipReason, number> = {
    opted_out: 0,
    recently_sent: 0,
    no_public_listings: 0,
    no_recipients: 0,
  };
  let due = 0;
  let sentCompanies = 0;
  let sentEmails = 0;
  let failures = 0;

  for (const company of companies) {
    const skip = (why: DigestSkipReason) => {
      skipped[why] += 1;
      if (verbose) console.log(`  company ${String(company.id).padStart(6)}  skip: ${SKIP_LABELS[why]}`);
    };

    try {
      // The two reasons the company row alone decides, before any per-company
      // read: an opted-out or recently-summarised company costs no query.
      const early = digestCompanySkipReason(company, now);
      if (early) {
        skip(early);
        continue;
      }

      const digest = await getEmployerDigest(company.id, now);
      if (!digest) {
        // Deleted between the listing and this read.
        skip('no_public_listings');
        continue;
      }
      const recipients = await listEmployerDigestRecipients(company.id);

      // The full decision again, on the row as it is NOW rather than as it was
      // when the list was read — an opt-out saved a second ago still counts.
      const reason = digestSkipReason(
        { notifyWeeklyDigest: digest.notifyWeeklyDigest, lastDigestSentAt: digest.lastDigestSentAt },
        now,
        { listings: digest.listings.length, recipients: recipients.length },
      );
      if (reason) {
        skip(reason);
        continue;
      }

      due += 1;
      const applications = digest.listings.reduce((n, l) => n + l.applicationsInPeriod, 0);
      const views = digest.listings.reduce(
        (n, l) => n + (digest.lastDigestSentAt ? l.viewsSinceDigest : l.viewCount),
        0,
      );
      console.log(
        `  company ${String(company.id).padStart(6)}  ${company.name}\n` +
          `          ${digest.listings.length} listing(s), ${views} view(s), ` +
          `${applications} application(s) in period, ${recipients.length} recipient(s)` +
          `${digest.lastDigestSentAt ? '' : ' — first summary'}`,
      );

      if (!apply) continue;

      let delivered = 0;
      for (const recipient of recipients) {
        const result = await sendEmail(
          employerWeeklyDigestMessage(recipient.email, recipient.name, {
            companyName: digest.companyName,
            previousDigestAt: digest.lastDigestSentAt,
            now,
            listings: digest.listings,
          }),
        );
        if (result.sent) delivered += 1;
        else console.error(`          send to one recipient FAILED (${result.reason})`);
      }

      if (delivered > 0) {
        // Stamped when AT LEAST ONE recipient got it, not only when all did.
        // A partial failure is still reported (and still fails the exit code),
        // but re-running would re-mail everyone who already has this week's
        // summary — the exact duplicate the interval exists to prevent. The
        // recipient who bounced gets next week's.
        await recordEmployerDigestSent(
          company.id,
          now,
          digest.listings.map((l) => ({ jobId: l.jobId, viewCount: l.viewCount })),
        );
        sentCompanies += 1;
        sentEmails += delivered;
      }
      if (delivered < recipients.length) {
        failures += 1;
        console.error(
          `          ${recipients.length - delivered} of ${recipients.length} send(s) failed` +
            (delivered === 0 ? ' — NOT recorded; due again on the next run.' : '.'),
        );
      }
    } catch (err) {
      failures += 1;
      console.error(
        `  company ${String(company.id).padStart(6)}  FAILED — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log('\nSummary');
  console.log('-------');
  console.log(`  due for a summary         ${due}`);
  for (const reason of Object.keys(skipped) as DigestSkipReason[]) {
    console.log(`  skipped: ${SKIP_LABELS[reason].padEnd(34)} ${skipped[reason]}`);
  }
  if (apply) {
    console.log(`  companies sent            ${sentCompanies}`);
    console.log(`  emails sent               ${sentEmails}`);
  } else {
    console.log('\nNothing was sent. Re-run with --apply to send.');
  }

  if (failures > 0) {
    console.error(`\n${failures} company(ies) FAILED. See the errors above.`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
