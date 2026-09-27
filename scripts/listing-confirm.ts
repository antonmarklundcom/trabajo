// npm run listings:confirm — "¿Tu aviso sigue abierto?" (lib/listing-confirm.ts).
//
// Emails the employer users of every published listing that expires within
// EXPIRY_WARNING_DAYS, with two signed one-click links: "Sí, sigue abierto"
// (renews by LISTING_DAYS) and "Ya lo cubrimos, cerralo" (archives it). A
// listing nobody answers for closes on its date, which the visibility predicate
// already does — this script only asks.
//
// Hostinger gives us no cron (DEPLOY.md), so it is run daily by hand or by a
// scheduled Claude Routine, which shapes it the way it shaped db:purge:
//
//   - **Dry run is the default.** `--apply` is required to send. An email is
//     the one side effect a dry run can never take back.
//   - **Idempotent per expiry.** A send is recorded in activity_log with the
//     `expires_at` it asked about, and a job is skipped while that row matches
//     its current expiry. Running it twice a day, or every day of the window,
//     asks each listing once; renewing it (by any path) moves the expiry and
//     makes it eligible again next cycle.
//   - **Ids, dates and counts only** in the output — never an email address.
//
// Two things must match production for the links to work, and both are
// checked before --apply sends anything:
//
//   - SESSION_SECRET. The links are signed with a key derived from it; a link
//     minted with a different secret is invalid on the live site. The run
//     prints the key's fingerprint, and /admin shows production's — compare.
//   - The link origin (NEXT_PUBLIC_SITE_URL, default https://trabajo.com.py).
//     A local .env pointing at http://localhost would mail dead links.
import { requireDatabaseUrl, describeTarget } from './require-db-url';

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const help = argv.includes('--help') || argv.includes('-h');
  const unknown = argv.filter((arg) => arg.startsWith('-') && !['--apply', '--help', '-h'].includes(arg));
  return { apply, help, unknown };
}

const HELP = `
npm run listings:confirm -- [--apply]

"¿Tu aviso sigue abierto?" — emails the employer users of each published
listing that expires within the warning window. Dry run by default: without
--apply it lists what it would send and sends nothing.

  --apply     Send the emails and record each send in activity_log.

Needs DATABASE_URL, the production SESSION_SECRET (compare the printed key
fingerprint with the one on /admin), RESEND_API_KEY + EMAIL_FROM, and
EMPLOYER_DASHBOARD_ENABLED=true (the links land under /empresa, which 404s
while the dashboard is off).
`;

function fmt(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

async function main() {
  const { apply, help, unknown } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP.trim());
    process.exit(0);
  }
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}\n`);
    console.error(HELP.trim());
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  const { emailUrl } = await import('../lib/email');
  const {
    LISTING_CONFIRM_TOKEN_TTL_MS,
    formatListingDate,
    listingConfirmKey,
    listingConfirmKeyFingerprint,
    signListingConfirmToken,
  } = await import('../lib/listing-confirm');
  const { EXPIRY_WARNING_DAYS, LISTING_DAYS } = await import('../lib/listing-expiry');

  // Configuration is checked before any query, and --apply refuses to start
  // on any problem: a batch of dead links is worse than no batch.
  const problems: string[] = [];
  let key: Buffer | null = null;
  try {
    key = listingConfirmKey();
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err));
  }
  const origin = new URL(emailUrl('/')).origin;

  console.log(`Target: ${describeTarget(url)}`);
  console.log(apply ? 'Mode:   APPLY — emails will be sent.' : 'Mode:   DRY RUN — nothing will be sent. Re-run with --apply to send.');
  console.log(`Links:  ${origin}/empresa/confirmar-aviso`);
  console.log(
    `Key:    ${key ? `fingerprint ${listingConfirmKeyFingerprint(key)} (must match /admin → "Confirmaciones por correo")` : 'unavailable'}`,
  );

  const dashboardOn = process.env.EMPLOYER_DASHBOARD_ENABLED?.trim().toLowerCase() === 'true';
  if (!origin.startsWith('https://')) problems.push(`link origin ${origin} is not https — set NEXT_PUBLIC_SITE_URL to the live site`);
  if (!dashboardOn) problems.push('EMPLOYER_DASHBOARD_ENABLED is not "true" — the links would land on a 404');
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) problems.push('RESEND_API_KEY / EMAIL_FROM unset — nothing would be delivered');
  for (const problem of problems) console.log(`  ${apply ? 'ERROR' : 'warning'}: ${problem}`);
  if (apply && (problems.length > 0 || !key)) {
    console.error('\nRefusing to send. Fix the configuration above and re-run.');
    process.exit(1);
  }
  const signingKey = key;

  // One clock for the run: every link in this batch carries the same issuedAt.
  const now = new Date();
  console.log(`Now:    ${now.toISOString()}  (window: expires within ${EXPIRY_WARNING_DAYS} days; links valid ${LISTING_CONFIRM_TOKEN_TTL_MS / 86_400_000} days)`);

  const confirm = await import('../lib/db/listing-confirm');
  const { listEmployerAccountRecipients } = await import('../lib/db/employer');
  const { sendEmail } = await import('../lib/email');
  const { listingConfirmMessage } = await import('../lib/emails/employer');

  const due = await confirm.findListingsDueForConfirmation();
  const alreadySent = await confirm.listConfirmationsSent(due.map((job) => job.id));

  console.log(`\n${due.length} published listing(s) expire within ${EXPIRY_WARNING_DAYS} days`);

  let sentJobs = 0;
  let skippedAsked = 0;
  let skippedNoRecipient = 0;
  let failedJobs = 0;

  for (const job of due) {
    const label = `  job ${String(job.id).padStart(7)}   expires ${fmt(job.expiresAt)}   company ${job.companyId}`;

    if (alreadySent.get(job.id)?.has(job.expiresAt.toISOString())) {
      skippedAsked += 1;
      console.log(`${label}   already asked for this expiry — skipped`);
      continue;
    }

    const recipients = await listEmployerAccountRecipients(job.companyId);
    if (recipients.length === 0) {
      // A company the team manages by WhatsApp only. /admin's "Avisos que
      // vencen" is still the reminder for those.
      skippedNoRecipient += 1;
      console.log(`${label}   no active employer account — skipped (use /admin → Avisos que vencen)`);
      continue;
    }

    if (!apply) {
      console.log(`${label}   would email ${recipients.length} user(s)`);
      continue;
    }

    const link = (action: 'open' | 'close') =>
      emailUrl(
        `/empresa/confirmar-aviso?t=${signListingConfirmToken(
          { jobId: job.id, action, expiresAt: job.expiresAt, issuedAt: now },
          signingKey!,
        )}`,
      );
    const openUrl = link('open');
    const closeUrl = link('close');

    let delivered = 0;
    for (const recipient of recipients) {
      const result = await sendEmail(
        listingConfirmMessage(
          recipient.email,
          recipient.name,
          { title: job.title, expiresAt: job.expiresAt, listingDays: LISTING_DAYS, openUrl, closeUrl },
          formatListingDate,
        ),
      );
      if (result.sent) delivered += 1;
      else console.error(`${label}   a send FAILED (${result.reason})`);
    }

    if (delivered > 0) {
      // Recorded only after a delivery, so an outage retries on the next run
      // instead of marking a listing asked that nobody heard about.
      await confirm.recordConfirmationSent(job.id, job.expiresAt, delivered);
      sentJobs += 1;
      console.log(`${label}   emailed ${delivered}/${recipients.length} user(s)`);
    } else {
      failedJobs += 1;
    }
  }

  const eligible = due.length - skippedAsked - skippedNoRecipient;
  console.log('\nSummary');
  console.log('-------');
  console.log(`  listings asked            ${apply ? 'done' : 'would do'}: ${apply ? sentJobs : eligible}`);
  console.log(`  already asked (skipped)            ${skippedAsked}`);
  console.log(`  no employer account (skipped)      ${skippedNoRecipient}`);
  if (!apply) console.log('\nNothing was sent. Re-run with --apply to send.');
  if (failedJobs > 0) {
    console.error(`\n${failedJobs} listing(s) could not be emailed. They will be retried on the next run.`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
