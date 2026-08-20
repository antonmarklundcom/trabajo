// npm run db:purge — the retention sweep (PLAN-PHASE2.md §4.3).
//
// Hostinger gives us no cron (DEPLOY.md), so this is a manual script, meant to
// be run monthly or driven by a scheduled Claude Routine. That shapes two
// decisions:
//
//   - **Dry run is the default.** `--apply` is required to change anything.
//     A retention sweep destroys data that is destroyed correctly and is still
//     gone forever, and the person running it is doing so from a laptop against
//     production. The default has to be the harmless one.
//   - **It prints exactly what it would touch**, by id and by date, before it
//     touches it. The dry run and the apply run compute their cutoffs once and
//     use the same query functions (lib/db/retention.ts), so the list you read
//     is the list that gets acted on.
//
// It prints ids and dates, never names, emails, phone numbers or filenames. A
// data-protection tool whose log file is itself a pile of personal data has
// solved nothing — and this output ends up pasted into terminals and issues.
//
// What it does, in order (the order matters: candidate purges write the
// deletion_requests rows that the consents rule reads):
//
//   1. Candidate profiles + CVs, 24 months after last login → full §4.4
//      deletion via deleteCandidateAccount(). Also reports who is inside the
//      23-month warning window, without acting.
//   2. Application personal data, 12 months after the job closed → redaction,
//      not row deletion.
//   3. consents, 5 years after the data they authorised was purged.
//   4. data_access_logs, 24 months.
//
// deletion_requests is retained indefinitely and never appears here: it holds
// no personal data by construction (§1.2), and it is the evidence that the rest
// of this script was allowed to run.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import {
  ACCESS_LOG_RETENTION_MONTHS,
  APPLICATION_REDACTION_MONTHS,
  CANDIDATE_INACTIVITY_MONTHS,
  CANDIDATE_WARNING_MONTHS,
  CONSENT_RETENTION_MONTHS,
  monthsAgo,
} from '../lib/retention';
import { sendEmail } from '../lib/email';
import { retentionWarningMessage } from '../lib/emails/candidate';

const DEFAULT_SAMPLE = 25;

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const verbose = argv.includes('--verbose');
  const help = argv.includes('--help') || argv.includes('-h');
  const unknown = argv.filter((arg) => arg.startsWith('-') && !['--apply', '--verbose', '--help', '-h'].includes(arg));
  return { apply, verbose, help, unknown };
}

const HELP = `
npm run db:purge -- [--apply] [--verbose]

Retention sweep, PLAN-PHASE2.md §4.3. Dry run by default: without --apply it
reads and prints, and changes nothing.

  --apply     Execute the deletions and redactions listed by the dry run.
  --verbose   Print every affected id instead of the first ${DEFAULT_SAMPLE} per section.

Retention periods live in lib/retention.ts (open question §8 Q1 — the owner
confirms these before they go into /privacidad).

Deleting candidates needs CV_STORAGE_DRIVER configured, because their CV
objects are removed from storage before any row that says where they are.
`;

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function listIds(label: string, rows: { id: number; when: Date }[], verbose: boolean): void {
  if (rows.length === 0) {
    console.log(`  nothing due`);
    return;
  }
  const shown = verbose ? rows : rows.slice(0, DEFAULT_SAMPLE);
  for (const row of shown) {
    console.log(`  ${label} ${String(row.id).padStart(7)}   ${fmt(row.when)}`);
  }
  if (shown.length < rows.length) {
    console.log(`  ... and ${rows.length - shown.length} more (--verbose to list them all)`);
  }
}

async function main() {
  const { apply, verbose, help, unknown } = parseArgs(process.argv.slice(2));
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
  console.log(`Target: ${describeTarget(url)}`);
  console.log(apply ? 'Mode:   APPLY — this run destroys data.' : 'Mode:   DRY RUN — nothing will be changed. Re-run with --apply to execute.');

  // One clock for the whole run. Recomputing cutoffs per section would let a
  // slow sweep act on a boundary the earlier sections did not report.
  const now = new Date();
  const candidateCutoff = monthsAgo(CANDIDATE_INACTIVITY_MONTHS, now);
  const warningCutoff = monthsAgo(CANDIDATE_WARNING_MONTHS, now);
  const applicationCutoff = monthsAgo(APPLICATION_REDACTION_MONTHS, now);
  const consentCutoff = monthsAgo(CONSENT_RETENTION_MONTHS, now);
  const accessLogCutoff = monthsAgo(ACCESS_LOG_RETENTION_MONTHS, now);

  console.log(`Now:    ${now.toISOString()}`);

  const retention = await import('../lib/db/retention');
  const { deleteCandidateAccount } = await import('../lib/db/candidate-arco');

  // Read everything first, then act. The apply run therefore acts on exactly
  // the set it printed, and a read failure cannot leave a half-applied sweep.
  const [dueCandidates, toWarn, dueApplications, dueConsents, dueAccessLogs, dueAuthEvents] =
    await Promise.all([
      retention.findCandidatesInactiveSince(candidateCutoff),
      retention.findCandidatesToWarn(warningCutoff, candidateCutoff),
      retention.findApplicationsToRedact(applicationCutoff),
      retention.findConsentsToDelete(consentCutoff),
      retention.findAccessLogsToDelete(accessLogCutoff),
      // Same 24-month clock as the access logs (PLAN-NEXT.md §2 A1).
      retention.findAuthEventsToDelete(accessLogCutoff),
    ]);

  if (apply && dueCandidates.length > 0) {
    // Fail before the first candidate rather than between the third and the
    // fourth: deleteCandidateAccount() hard-fails on a storage error by design,
    // and an unset CV_STORAGE_DRIVER is a configuration mistake, not a reason
    // to leave the sweep half-done.
    const { getStorage } = await import('../lib/storage');
    getStorage();
  }

  let failures = 0;

  // -------------------------------------------------------------------------
  section(`1. Candidate profiles + CVs — inactive ${CANDIDATE_INACTIVITY_MONTHS} months (last activity before ${fmt(candidateCutoff)})`);
  console.log(`  ${dueCandidates.length} candidate(s) due for full deletion (PLAN-PHASE2.md §4.4)`);
  listIds(
    'candidate',
    dueCandidates.map((c) => ({ id: c.id, when: c.lastActivityAt })),
    verbose,
  );

  if (apply) {
    for (const candidate of dueCandidates) {
      try {
        const counts = await deleteCandidateAccount(candidate.id, {
          requestedBy: 'admin',
          note: `Retention sweep: inactive since ${fmt(candidate.lastActivityAt)}.`,
        });
        if (!counts) {
          console.log(`  candidate ${candidate.id}: already gone, skipped`);
          continue;
        }
        console.log(
          `  candidate ${candidate.id}: deleted (deletion_request ${counts.deletionRequestId}, ` +
            `${counts.cvObjectsDeleted} CV object(s), ${counts.applicationsRedacted} application(s) redacted, ` +
            `${counts.consentsKept} consent row(s) kept)`,
        );
      } catch (err) {
        // One candidate's storage failure must not abort the other three. The
        // deletion_requests row written in §4.4 step 1 records the failure, and
        // the non-zero exit below makes sure a scheduled run does not look green.
        failures += 1;
        console.error(
          `  candidate ${candidate.id}: FAILED — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // The warning now actually sends (PLAN-NEXT.md §2 E2). --apply keeps its
  // meaning exactly: a dry run lists who WOULD be warned and sends nothing,
  // which matters more here than elsewhere in this script because the side
  // effect leaves the database and lands in someone's inbox — the one action a
  // dry run cannot take back.
  section(`   Warning window — inactive ${CANDIDATE_WARNING_MONTHS} months`);
  console.log(`  ${toWarn.length} candidate(s) to warn before their profile is purged`);
  listIds(
    'candidate',
    toWarn.map((c) => ({ id: c.id, when: c.lastActivityAt })),
    verbose,
  );

  let warned = 0;
  let warnFailures = 0;

  if (apply && toWarn.length > 0) {
    const monthsUntilPurge = CANDIDATE_INACTIVITY_MONTHS - CANDIDATE_WARNING_MONTHS;

    for (const candidate of toWarn) {
      const result = await sendEmail(
        retentionWarningMessage(candidate.email, candidate.name, monthsUntilPurge),
      );

      if (result.sent) {
        // Stamped only after a successful send. A provider outage therefore
        // means this candidate is warned on the NEXT run, rather than being
        // marked warned and then purged having never heard from us — which is
        // the exact failure /privacidad §4.3 would be describing falsely.
        await retention.markRetentionWarned(candidate.id, now);
        warned += 1;
      } else {
        warnFailures += 1;
        console.error(`  candidate ${candidate.id}: warning NOT sent (${result.reason})`);
      }
    }
  }

  if (toWarn.length > 0 && !apply) {
    console.log('  (dry run — no email sent)');
  }

  // -------------------------------------------------------------------------
  section(`2. Application personal data — ${APPLICATION_REDACTION_MONTHS} months after the job closed (before ${fmt(applicationCutoff)})`);
  console.log(`  ${dueApplications.length} application(s) due for redaction (row survives, personal columns NULLed)`);
  listIds(
    'application',
    dueApplications.map((a) => ({ id: a.id, when: a.jobClosedAt })),
    verbose,
  );

  let redacted = 0;
  if (apply && dueApplications.length > 0) {
    redacted = await retention.redactApplications(
      dueApplications.map((a) => a.id),
      now,
    );
    console.log(`  redacted ${redacted} application(s)`);
  }

  // -------------------------------------------------------------------------
  section(`3. consents — ${CONSENT_RETENTION_MONTHS} months after the data they authorised was purged (purged before ${fmt(consentCutoff)})`);
  console.log(`  ${dueConsents.length} consent row(s) due for deletion`);
  console.log('  (only for candidates already purged — a live candidate\'s consent ledger is never swept)');
  listIds(
    'consent',
    dueConsents.map((c) => ({ id: c.id, when: c.purgedAt })),
    verbose,
  );

  let consentsDeleted = 0;
  if (apply && dueConsents.length > 0) {
    consentsDeleted = await retention.deleteConsents(dueConsents.map((c) => c.id));
    console.log(`  deleted ${consentsDeleted} consent row(s)`);
  }

  // -------------------------------------------------------------------------
  section(`4. data_access_logs — ${ACCESS_LOG_RETENTION_MONTHS} months (before ${fmt(accessLogCutoff)})`);
  console.log(`  ${dueAccessLogs.length} log row(s) due for deletion`);
  listIds(
    'log',
    dueAccessLogs.map((l) => ({ id: l.id, when: l.createdAt })),
    verbose,
  );

  let logsDeleted = 0;
  if (apply && dueAccessLogs.length > 0) {
    logsDeleted = await retention.deleteAccessLogs(dueAccessLogs.map((l) => l.id));
    console.log(`  deleted ${logsDeleted} log row(s)`);
  }

  // -------------------------------------------------------------------------
  section(`5. auth_events — ${ACCESS_LOG_RETENTION_MONTHS} months (before ${fmt(accessLogCutoff)})`);
  console.log(`  ${dueAuthEvents.length} authentication event(s) due for deletion`);
  listIds(
    'auth event',
    dueAuthEvents.map((e) => ({ id: e.id, when: e.createdAt })),
    verbose,
  );
  let authEventsDeleted = 0;
  if (apply && dueAuthEvents.length > 0) {
    authEventsDeleted = await retention.deleteAuthEvents(dueAuthEvents.map((e) => e.id));
  }

  // -------------------------------------------------------------------------
  section('Summary');
  const verb = apply ? 'done' : 'would do';
  console.log(`  candidates deleted        ${verb}: ${dueCandidates.length - failures}`);
  console.log(`  applications redacted     ${verb}: ${apply ? redacted : dueApplications.length}`);
  console.log(`  consent rows deleted      ${verb}: ${apply ? consentsDeleted : dueConsents.length}`);
  console.log(`  access log rows deleted   ${verb}: ${apply ? logsDeleted : dueAccessLogs.length}`);
  console.log(`  auth event rows deleted   ${verb}: ${apply ? authEventsDeleted : dueAuthEvents.length}`);
  console.log(`  candidates warned         ${verb}: ${apply ? warned : toWarn.length}`);
  if (!apply) {
    console.log('\nNothing was changed. Re-run with --apply to execute.');
  }
  if (warnFailures > 0) {
    // Not fatal: nothing was destroyed and nobody was marked warned, so the
    // next run retries them. Reported loudly because a warning that never
    // sends is a policy the site is not keeping.
    console.error(`\n${warnFailures} retention warning(s) could not be sent. They will be retried on the next run.`);
  }

  if (failures > 0) {
    console.error(`\n${failures} candidate deletion(s) FAILED and were left in place. See the errors above.`);
    // Deliberately NOT stamped: a run that left candidates in place has not
    // completed, and recording it would make /admin report the one thing this
    // stamp exists to contradict — that the sweep is current when it is not.
    process.exit(1);
  }

  // O2 (PLAN-NEXT.md §3). Only on --apply, and only here, after everything
  // succeeded: a dry run must not claim a purge happened, since a dry run is
  // exactly what someone does when they are not sure whether to.
  if (apply) {
    const { recordPurgeRun } = await import('../lib/db/ops-state');
    await recordPurgeRun(new Date());
    console.log('\n  run recorded in ops_state — /admin will show it as current.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
