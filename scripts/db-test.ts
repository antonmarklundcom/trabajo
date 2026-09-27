// DB-backed tests: the real lib/db/* functions against a real, THROWAWAY MySQL.
//
//   DB_TEST_ALLOW_DESTRUCTIVE=1 \
//   DATABASE_URL='mysql://root:test@127.0.0.1:3306/trabajo_test' \
//   npm run db:test
//
// Why this exists next to the source-reading *:verify scripts: those assert
// pure functions and what a file says, and the bugs the external review found
// were in what a query DOES — an application INSERT that strict mode rejected,
// a registration that half-committed, a delete that left applicants' details
// outside every retention clock. None of that is visible without executing SQL
// against MySQL, so CI runs this file against a `mysql:8.0` service container
// on the one existing job (.github/workflows/ci.yml).
//
// What it covers, one numbered case each, so a CI failure names its case:
//   1. Public visibility — pending, rejected and expired jobs never come out of
//      the lib/data.ts seam (DATA_SOURCE=db); a published one does.
//   2. createApplication — refuses closed/unpublished jobs, stores an open one,
//      and still inserts an over-long phone and source page (fitted, PR #125).
//   3. deleteJob redaction + the orphan sweep in lib/db/retention.ts.
//   4. Employer scoping — scripts/verify-scoping.ts's assertions, run as-is.
//   5. acceptInvitation — one user + one consent on success; a forced failure
//      (email already taken) leaves the invitation unclaimed and no new user.
//
// SAFETY. It migrates, writes and deletes, so it refuses to start unless BOTH:
//   - DATABASE_URL's host is localhost / 127.0.0.1 / ::1, and
//   - DB_TEST_ALLOW_DESTRUCTIVE=1 is set.
// There is deliberately no --force: production is never a local host, and a
// test suite has no reason to run anywhere but a database made for it. Every
// row it writes carries the `zzdbtest-` prefix (or the DBTEST_ACTOR id) and is
// removed at the start and end of a run, so re-running against a local dev
// database is safe — but a fresh container is what it is meant for.
//
// Runs under `tsx --conditions=react-server` so `server-only` resolves to its
// no-op build, the same way scripts/verify-scoping.ts does.
import { requireDatabaseUrl, describeTarget } from './require-db-url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const PREFIX = 'zzdbtest-';
/** activity_log.actor_user_id for every write this script causes. No FK, so any id works. */
const DBTEST_ACTOR = 987_654_321;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Guard — before anything under lib/db is imported (its pool is built at
// module evaluation).
// ---------------------------------------------------------------------------

function refuse(reason: string): never {
  console.error(`db:test refused to run: ${reason}\n`);
  console.error(
    'This script migrates, writes and deletes rows. It only runs against a local,\n' +
      'throwaway database, and only with DB_TEST_ALLOW_DESTRUCTIVE=1 set. See DEPLOY.md\n' +
      '"npm run db:test" for the one-line Docker MySQL to point it at.',
  );
  process.exit(2);
}

const url = requireDatabaseUrl();
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  refuse('DATABASE_URL is not parseable.');
}
if (!LOCAL_HOSTS.has(host)) {
  refuse(`DATABASE_URL points at "${host}", not localhost/127.0.0.1.`);
}
if (process.env.DB_TEST_ALLOW_DESTRUCTIVE !== '1') {
  refuse('DB_TEST_ALLOW_DESTRUCTIVE=1 is not set.');
}
// The public-visibility case reads through lib/data.ts, which only touches the
// database in db mode (it falls back to the seed JSON otherwise).
process.env.DATA_SOURCE = 'db';

// ---------------------------------------------------------------------------
// check() — the whole "framework".
// ---------------------------------------------------------------------------

let currentCase = '';
const failed: string[] = [];
let passed = 0;

function check(condition: boolean, description: string, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${description}`);
  } else {
    const line = `[${currentCase}] ${description}`;
    failed.push(line);
    console.error(`  FAIL  ${description}`);
    if (detail !== undefined) console.error(`        got: ${JSON.stringify(detail)}`);
  }
}

/**
 * Runs one numbered case. An unexpected throw is recorded as a failure OF THAT
 * CASE and the next case still runs, so one broken query cannot hide the
 * results of the others.
 */
async function runCase(name: string, fn: () => Promise<void>) {
  currentCase = name;
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    // Summary line kept short: a failed INSERT's message carries every bound
    // parameter, and the full text is printed just below anyway.
    const short = (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 200);
    failed.push(`[${name}] threw: ${short}`);
    console.error(`  FAIL  case threw unexpectedly:\n${message}`);
  }
}

async function main() {
  console.log(`db:test target: ${describeTarget(url)}`);
  const started = Date.now();

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  const { and, eq, inArray, like, sql } = await import('drizzle-orm');

  // A just-started container can take a few seconds to accept connections.
  // CI's service health check makes this a no-op there; locally it saves
  // having to time `docker run` by hand.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await db.execute(sql`SELECT 1`);
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const { migrate } = await import('drizzle-orm/mysql2/migrator');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log(`migrations applied (${Date.now() - started} ms)`);

  // -------------------------------------------------------------------------
  // Fixture cleanup — dependents before parents, same as the app (no FKs).
  // -------------------------------------------------------------------------
  async function cleanup() {
    const companyIds = (
      await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(like(schema.companies.slug, `${PREFIX}%`))
    ).map((r) => r.id);
    const jobIds = (
      await db.select({ id: schema.jobs.id }).from(schema.jobs).where(like(schema.jobs.slug, `${PREFIX}%`))
    ).map((r) => r.id);
    const userIds = (
      await db.select({ id: schema.users.id }).from(schema.users).where(like(schema.users.email, `${PREFIX}%`))
    ).map((r) => r.id);

    // Every fixture application carries the prefix in source_page, which
    // redaction does not clear — so orphans of deleted fixture jobs are found too.
    await db.delete(schema.applications).where(like(schema.applications.sourcePage, `/${PREFIX}%`));
    if (jobIds.length > 0) {
      await db.delete(schema.applications).where(inArray(schema.applications.jobId, jobIds));
      await db.delete(schema.jobs).where(inArray(schema.jobs.id, jobIds));
    }
    if (userIds.length > 0) {
      await db
        .delete(schema.consents)
        .where(and(eq(schema.consents.subjectType, 'employer_user'), inArray(schema.consents.subjectId, userIds)));
      await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    }
    if (companyIds.length > 0) {
      await db.delete(schema.employerInvitations).where(inArray(schema.employerInvitations.companyId, companyIds));
      await db.delete(schema.companies).where(inArray(schema.companies.id, companyIds));
    }
    await db.delete(schema.activityLog).where(eq(schema.activityLog.actorUserId, DBTEST_ACTOR));
    await db.delete(schema.categories).where(like(schema.categories.slug, `${PREFIX}%`));
    await db.delete(schema.cities).where(like(schema.cities.slug, `${PREFIX}%`));
  }

  await cleanup();

  // -------------------------------------------------------------------------
  // Shared fixtures.
  // -------------------------------------------------------------------------
  const now = new Date();
  const [categoryRes] = await db
    .insert(schema.categories)
    .values({ slug: `${PREFIX}categoria`, name: 'Categoría de prueba', createdAt: now });
  const [cityRes] = await db
    .insert(schema.cities)
    .values({ slug: `${PREFIX}ciudad`, name: 'Ciudad de prueba', createdAt: now });
  const categoryId = categoryRes.insertId;
  const cityId = cityRes.insertId;

  async function makeCompany(label: string) {
    const [res] = await db.insert(schema.companies).values({
      name: `${PREFIX}Empresa ${label}`,
      slug: `${PREFIX}${label}`,
      createdAt: now,
      updatedAt: now,
    });
    return { id: res.insertId, slug: `${PREFIX}${label}` };
  }

  async function makeJob(
    companyId: number,
    label: string,
    fields: Partial<typeof schema.jobs.$inferInsert> = {},
  ) {
    const slug = `${PREFIX}${label}`;
    const [res] = await db.insert(schema.jobs).values({
      slug,
      title: `Puesto ${PREFIX}${label}`,
      companyId,
      categoryId,
      cityId,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryHidden: true,
      description: 'Descripción de prueba.',
      status: 'published',
      publishedAt: now,
      expiresAt: new Date(now.getTime() + 30 * DAY_MS),
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
    return { id: res.insertId, slug };
  }

  async function makeApplication(jobId: number, label: string) {
    const [res] = await db.insert(schema.applications).values({
      jobId,
      name: `Postulante ${label}`,
      phone: '595981000000',
      email: `${label}@example.py`,
      message: 'Mensaje de prueba',
      sourcePage: `/${PREFIX}${label}`,
      status: 'new',
      createdAt: now,
    });
    return res.insertId;
  }

  async function readApplication(id: number) {
    const [row] = await db.select().from(schema.applications).where(eq(schema.applications.id, id));
    return row ?? null;
  }

  try {
    // =======================================================================
    // 1. Public visibility, through the lib/data.ts seam.
    // =======================================================================
    await runCase('1 public visibility', async () => {
      const data = await import('../lib/data');
      const visible = await makeCompany('vis');
      const hiddenOnly = await makeCompany('vis-hidden-only');
      const featured = new Date(now.getTime() + 10 * DAY_MS);

      // Every hidden row is also "featured", so a featured query that skipped
      // the visibility predicate would surface it.
      const live = await makeJob(visible.id, 'vis-live', { featuredUntil: featured });
      const noExpiry = await makeJob(visible.id, 'vis-noexpiry', { expiresAt: null });
      const pending = await makeJob(visible.id, 'vis-pending', {
        status: 'pending',
        publishedAt: null,
        featuredUntil: featured,
      });
      const rejected = await makeJob(visible.id, 'vis-rejected', {
        status: 'rejected',
        publishedAt: null,
        featuredUntil: featured,
      });
      const expired = await makeJob(visible.id, 'vis-expired', {
        expiresAt: new Date(now.getTime() - DAY_MS),
        featuredUntil: featured,
      });
      await makeJob(hiddenOnly.id, 'vis-hidden-only-pending', { status: 'pending', publishedAt: null });

      const hidden = [pending, rejected, expired];
      const shown = [live, noExpiry];

      for (const job of shown) {
        check((await data.getJob(job.slug)) !== null, `getJob returns published ${job.slug}`);
      }
      for (const job of hidden) {
        check((await data.getJob(job.slug)) === null, `getJob returns null for ${job.slug}`);
      }

      const all = new Set((await data.getAllPublishedJobSummaries()).map((j) => j.slug));
      for (const job of shown) check(all.has(job.slug), `full catalogue includes ${job.slug}`);
      for (const job of hidden) check(!all.has(job.slug), `full catalogue excludes ${job.slug}`);

      const byCompany = (await data.getCompanyJobs(visible.slug)).map((j) => j.slug).sort();
      check(
        JSON.stringify(byCompany) === JSON.stringify(shown.map((j) => j.slug).sort()),
        'getCompanyJobs lists exactly the two visible jobs',
        byCompany,
      );

      const search = (await data.getJobs({ q: `${PREFIX}vis`, page: 1 })).jobs.map((j) => j.slug);
      for (const job of hidden) check(!search.includes(job.slug), `text search excludes ${job.slug}`);

      const featuredSlugs = (await data.getFeaturedJobs(100)).map((j) => j.slug);
      check(featuredSlugs.includes(live.slug), 'getFeaturedJobs includes the featured published job');
      for (const job of hidden) check(!featuredSlugs.includes(job.slug), `getFeaturedJobs excludes ${job.slug}`);

      const recentSlugs = (await data.getRecentJobs(100)).map((j) => j.slug);
      for (const job of hidden) check(!recentSlugs.includes(job.slug), `getRecentJobs excludes ${job.slug}`);

      const category = await data.getCategory(`${PREFIX}categoria`);
      check(category?.jobCount === 2, 'category jobCount counts only the two visible jobs', category?.jobCount);

      // The tombstone read is the one exception to the predicate: expired yes,
      // never-approved no.
      check((await data.getClosedJob(expired.slug)) !== null, 'getClosedJob returns a tombstone for the expired job');
      check((await data.getClosedJob(pending.slug)) === null, 'getClosedJob returns null for a pending job');
      check((await data.getClosedJob(rejected.slug)) === null, 'getClosedJob returns null for a rejected job');

      check((await data.getCompany(visible.slug)) !== null, 'getCompany returns a company with an approved job');
      check(
        (await data.getCompany(hiddenOnly.slug)) === null,
        'getCompany returns null for a company with no approved job',
      );
    });

    // =======================================================================
    // 2. createApplication.
    // =======================================================================
    await runCase('2 createApplication', async () => {
      const admin = await import('../lib/db/admin');
      const company = await makeCompany('app');
      const open = await makeJob(company.id, 'app-open');
      const pending = await makeJob(company.id, 'app-pending', { status: 'pending', publishedAt: null });
      const archived = await makeJob(company.id, 'app-archived', { status: 'archived' });
      const expired = await makeJob(company.id, 'app-expired', { expiresAt: new Date(now.getTime() - DAY_MS) });

      const input = (jobSlug: string, extra: Partial<Parameters<typeof admin.createApplication>[0]> = {}) => ({
        jobSlug,
        name: 'Postulante de prueba',
        phone: '0981 123 456',
        email: 'postulante@example.py',
        message: 'Hola',
        sourcePage: `/${PREFIX}app`,
        ...extra,
      });

      for (const [label, slug] of [
        ['pending', pending.slug],
        ['archived', archived.slug],
        ['expired', expired.slug],
        ['nonexistent', `${PREFIX}no-such-job`],
      ] as const) {
        check((await admin.createApplication(input(slug))) === null, `refuses a ${label} job (returns null)`);
      }
      const [{ n: refusedRows }] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.applications)
        .where(inArray(schema.applications.jobId, [pending.id, archived.id, expired.id]));
      check(refusedRows === 0, 'no row was written for any refused job', refusedRows);

      const ok = await admin.createApplication(input(open.slug));
      check(ok !== null, 'stores an application to an open job');
      if (ok) {
        check(ok.companyId === company.id, "returns the job's companyId", ok.companyId);
        const row = await readApplication(ok.applicationId);
        check(row?.jobId === open.id, 'row points at the job', row?.jobId);
        check(row?.phone === '0981 123 456', 'a phone that fits is stored verbatim', row?.phone);
        check(row?.status === 'new' && row?.redactedAt === null, 'row is new and not redacted');
      }

      // PR #125: strict mode used to reject these INSERTs outright.
      const longPhone = '+595 (981) 123-456 ext 78'; // 25 chars
      const longSource = `/${PREFIX}app/${'x'.repeat(400)}`;
      check(longPhone.length === 25, 'fixture phone is 25 characters');
      const fitted = await admin.createApplication(input(open.slug, { phone: longPhone, sourcePage: longSource }));
      check(fitted !== null, 'a 25-char phone and a 400+-char source page still insert');
      if (fitted) {
        const row = await readApplication(fitted.applicationId);
        check(
          row?.phone === '59598112345678',
          'the over-long phone is stored as its digits, within varchar(20)',
          row?.phone,
        );
        check(row?.sourcePage?.length === 255, 'the source page is cut to varchar(255)', row?.sourcePage?.length);
      }
    });

    // =======================================================================
    // 3. deleteJob redaction and the orphan sweep.
    // =======================================================================
    await runCase('3 deleteJob redaction + orphan sweep', async () => {
      const admin = await import('../lib/db/admin');
      const retention = await import('../lib/db/retention');
      const company = await makeCompany('del');

      const doomed = await makeJob(company.id, 'del-doomed');
      const doomedApps = [await makeApplication(doomed.id, 'del-a'), await makeApplication(doomed.id, 'del-b')];
      const survivor = await makeJob(company.id, 'del-survivor');
      const survivorApp = await makeApplication(survivor.id, 'del-survivor');

      await admin.deleteJob(doomed.id, DBTEST_ACTOR);

      const [jobRow] = await db.select({ id: schema.jobs.id }).from(schema.jobs).where(eq(schema.jobs.id, doomed.id));
      check(jobRow === undefined, 'the job row is gone');
      for (const id of doomedApps) {
        const row = await readApplication(id);
        check(row !== null, `application ${id} survives as a husk (not deleted)`);
        check(
          row !== null &&
            row.name === null &&
            row.phone === null &&
            row.email === null &&
            row.message === null &&
            row.redactedAt !== null,
          `application ${id} has name/phone/email/message NULL and redacted_at set`,
          row && { name: row.name, phone: row.phone, email: row.email, message: row.message, redactedAt: row.redactedAt },
        );
      }
      const survivorRow = await readApplication(survivorApp);
      check(
        survivorRow?.name !== null && survivorRow?.redactedAt === null,
        "another job's application is untouched",
      );

      let orphansIds = (await retention.findApplicationsOfDeletedJobs()).map((r) => r.id);
      check(
        doomedApps.every((id) => !orphansIds.includes(id)),
        "deleteJob's applications are already redacted, so the orphan sweep has nothing left of them",
      );

      // The pre-fix shape: a job row deleted WITHOUT going through deleteJob().
      const bare = await makeJob(company.id, 'del-bare');
      const orphan = await makeApplication(bare.id, 'del-orphan');
      await db.delete(schema.jobs).where(eq(schema.jobs.id, bare.id));

      orphansIds = (await retention.findApplicationsOfDeletedJobs()).map((r) => r.id);
      check(orphansIds.includes(orphan), 'findApplicationsOfDeletedJobs finds the orphan of a directly deleted job');
      check(!orphansIds.includes(survivorApp), 'findApplicationsOfDeletedJobs ignores applications of live jobs');

      const redacted = await retention.redactApplications([orphan], new Date());
      check(redacted === 1, 'redactApplications redacts exactly the one orphan', redacted);
      const orphanRow = await readApplication(orphan);
      check(
        orphanRow !== null && orphanRow.name === null && orphanRow.phone === null && orphanRow.redactedAt !== null,
        'the orphan is redacted',
      );
      check(
        !(await retention.findApplicationsOfDeletedJobs()).some((r) => r.id === orphan),
        'a redacted orphan is no longer reported',
      );
      check((await retention.redactApplications([orphan], new Date())) === 0, 'redactApplications is idempotent');
    });

    // =======================================================================
    // 4. Employer scoping — the existing script's assertions, not a copy.
    // =======================================================================
    await runCase('4 employer scoping (scripts/verify-scoping.ts)', async () => {
      const { runScopingChecks } = await import('./verify-scoping');
      const scopingFailures = await runScopingChecks();
      check(scopingFailures === 0, 'every verify-scoping assertion passed (see FAIL lines above)', scopingFailures);
    });

    // =======================================================================
    // 5. acceptInvitation atomicity.
    // =======================================================================
    await runCase('5 acceptInvitation', async () => {
      const invitations = await import('../lib/db/employer-invitations');
      const company = await makeCompany('inv');

      const countUsers = async (email: string) =>
        (await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email))).length;
      const countConsents = async () =>
        (
          await db
            .select({ id: schema.consents.id })
            .from(schema.consents)
            .where(eq(schema.consents.relatedCompanyId, company.id))
        ).length;
      const accepted = async (email: string) => {
        const [row] = await db
          .select({ acceptedAt: schema.employerInvitations.acceptedAt })
          .from(schema.employerInvitations)
          .where(
            and(
              eq(schema.employerInvitations.companyId, company.id),
              eq(schema.employerInvitations.email, email),
            ),
          );
        return row?.acceptedAt ?? null;
      };
      const accountInput = { name: 'Empleador de prueba', passwordHash: 'x'.repeat(60), ip: null, userAgent: null };

      // --- success ----------------------------------------------------------
      const goodEmail = `${PREFIX}inv-ok@example.py`;
      const { token } = await invitations.createEmployerInvitation(company.id, goodEmail, DBTEST_ACTOR);
      const userId = await invitations.acceptInvitation(token, accountInput);
      check(userId !== null, 'a valid invitation is accepted');
      check((await countUsers(goodEmail)) === 1, 'exactly one user was created');
      const [user] = await db
        .select({ role: schema.users.role, companyId: schema.users.companyId })
        .from(schema.users)
        .where(eq(schema.users.email, goodEmail));
      check(
        user?.role === 'employer' && user?.companyId === company.id,
        "the user is an employer of the inviting company",
        user,
      );
      const consentRows = await db
        .select({ purpose: schema.consents.purpose, subjectType: schema.consents.subjectType })
        .from(schema.consents)
        .where(eq(schema.consents.subjectId, userId ?? -1));
      check(
        consentRows.length === 1 &&
          consentRows[0].purpose === 'terms_acceptance' &&
          consentRows[0].subjectType === 'employer_user',
        'exactly one terms_acceptance consent was recorded for that user',
        consentRows,
      );
      check((await accepted(goodEmail)) !== null, 'the invitation is marked accepted');
      check((await invitations.acceptInvitation(token, accountInput)) === null, 'the same token cannot be used twice');
      check((await countUsers(goodEmail)) === 1, 'a second accept created no second user');
      check((await countConsents()) === 1, 'a second accept created no second consent');

      // --- forced failure: the email already has an account ------------------
      const takenEmail = `${PREFIX}inv-taken@example.py`;
      const other = await makeCompany('inv-other');
      const [existing] = await db.insert(schema.users).values({
        email: takenEmail,
        passwordHash: 'y'.repeat(60),
        name: 'Cuenta existente',
        role: 'employer',
        companyId: other.id,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const consentsBefore = await countConsents();
      const { token: takenToken } = await invitations.createEmployerInvitation(company.id, takenEmail, DBTEST_ACTOR);

      let threw = false;
      let result: number | null = null;
      try {
        result = await invitations.acceptInvitation(takenToken, accountInput);
      } catch {
        threw = true; // the users.email unique index — expected
      }
      check(threw || result === null, 'accepting with an already-registered email does not succeed', result);
      check((await accepted(takenEmail)) === null, 'the failed accept left the invitation UNCLAIMED (rolled back)');
      check(
        (await invitations.getInvitationByToken(takenToken)) !== null,
        'the invitation link still works after the failure',
      );
      const takenRows = await db
        .select({ id: schema.users.id, companyId: schema.users.companyId })
        .from(schema.users)
        .where(eq(schema.users.email, takenEmail));
      check(
        takenRows.length === 1 && takenRows[0].id === existing.insertId && takenRows[0].companyId === other.id,
        'no user was created, and the existing account was not moved to the inviting company',
        takenRows,
      );
      check((await countConsents()) === consentsBefore, 'no consent row was written by the failed accept');
    });
  } finally {
    try {
      await cleanup();
      console.log('\nfixtures removed');
    } catch (err) {
      console.error('\nWARNING: fixture cleanup failed (harmless on a throwaway database):', err);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed.length > 0) {
    console.error(`\ndb:test: ${failed.length} FAILED, ${passed} passed (${seconds}s)`);
    for (const line of failed) console.error(`  - ${line}`);
    process.exit(1);
  }
  console.log(`\ndb:test: all ${passed} checks passed (${seconds}s)`);
  process.exit(0);
}

main().catch((err) => {
  // Setup (connect, migrate, fixtures) failed — no case ran.
  console.error('db:test could not run its setup:', err);
  process.exit(1);
});
