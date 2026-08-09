// Proves that lib/db/employer.ts cannot return or modify another company's
// data (PLAN-PHASE2.md §2.3).
//
//   npm run db:verify-scoping
//
// Why this script exists when the rest of the repo has no test suite: the
// failure it guards against is silent. A missing companyId in a WHERE clause
// produces a page that renders perfectly — with someone else's applicants on
// it. Nothing in `next build`, in lint, or in a manual click-through catches
// that, because a leak looks exactly like a working feature to whoever is
// logged in.
//
// The shape of the check is deliberate: rather than asserting "company A sees
// its own 2 jobs", which passes just as happily if the query returns all jobs
// in the database, every assertion is a NEGATIVE one — company B's data must be
// absent from company A's results, and company A's writes against company B's
// rows must affect zero rows.
//
// Destructive: it writes fixtures and deletes them again, so it refuses to run
// against a non-local database unless --force is passed. Do not point it at
// production.
import { and, eq, inArray, like } from 'drizzle-orm';
import { requireDatabaseUrl, describeTarget } from './require-db-url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const FIXTURE_PREFIX = '__scopingtest__';

let failures = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ok    ${description}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${description}`);
  }
}

function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}\n`);

  if (!isLocal(url) && !process.argv.includes('--force')) {
    console.error(
      'Refusing to write fixtures to a non-local database.\n' +
        'This script creates and deletes rows. Pass --force only if you really mean it.',
    );
    process.exit(1);
  }

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  const employer = await import('../lib/db/employer');

  const now = new Date();

  // -------------------------------------------------------------------------
  // Fixtures: two companies, each with one job and one application. Everything
  // is prefixed so cleanup can find it even if a previous run died halfway.
  // -------------------------------------------------------------------------
  async function cleanup() {
    const ownJobs = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(like(schema.jobs.slug, `${FIXTURE_PREFIX}%`));
    if (ownJobs.length > 0) {
      await db.delete(schema.applications).where(
        inArray(
          schema.applications.jobId,
          ownJobs.map((j) => j.id),
        ),
      );
      await db.delete(schema.jobs).where(
        inArray(
          schema.jobs.id,
          ownJobs.map((j) => j.id),
        ),
      );
    }
    await db.delete(schema.companies).where(like(schema.companies.slug, `${FIXTURE_PREFIX}%`));
  }

  await cleanup();

  const [category] = await db.select({ id: schema.categories.id }).from(schema.categories).limit(1);
  const [city] = await db.select({ id: schema.cities.id }).from(schema.cities).limit(1);
  if (!category || !city) {
    console.error('No categories/cities in the database. Run `npm run db:seed` first.');
    process.exit(1);
  }

  async function makeCompany(label: string) {
    const [company] = await db.insert(schema.companies).values({
      name: `${FIXTURE_PREFIX}${label}`,
      slug: `${FIXTURE_PREFIX}${label}`,
      createdAt: now,
      updatedAt: now,
    });
    const [job] = await db.insert(schema.jobs).values({
      slug: `${FIXTURE_PREFIX}${label}-job`,
      title: `${FIXTURE_PREFIX} Puesto ${label}`,
      companyId: company.insertId,
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'fixture',
      whatsapp: null,
      status: 'published',
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const [application] = await db.insert(schema.applications).values({
      jobId: job.insertId,
      name: `${FIXTURE_PREFIX}Postulante ${label}`,
      phone: '595981000000',
      email: `${label}@example.py`,
      message: 'fixture',
      status: 'new',
      createdAt: now,
    });
    return { companyId: company.insertId, jobId: job.insertId, applicationId: application.insertId };
  }

  const a = await makeCompany('a');
  const b = await makeCompany('b');
  const actor = 1; // any id — activity_log has no FK constraint

  console.log(`Fixtures: company A=${a.companyId} job=${a.jobId} app=${a.applicationId}`);
  console.log(`          company B=${b.companyId} job=${b.jobId} app=${b.applicationId}\n`);

  try {
    // -----------------------------------------------------------------------
    // Reads: B's rows must be absent from A's results.
    // -----------------------------------------------------------------------
    console.log('reads');

    const jobList = await employer.listEmployerJobs(a.companyId);
    assert(
      jobList.jobs.every((j) => j.id !== b.jobId),
      "listEmployerJobs excludes another company's job",
    );
    assert(jobList.total === 1, `listEmployerJobs total counts only own jobs (got ${jobList.total})`);

    assert(
      (await employer.getEmployerJob(a.companyId, b.jobId)) === null,
      "getEmployerJob returns null for another company's job",
    );

    const options = await employer.listEmployerJobOptions(a.companyId);
    assert(
      options.every((o) => o.id !== b.jobId),
      "listEmployerJobOptions excludes another company's job",
    );

    const appList = await employer.listEmployerApplications(a.companyId);
    assert(
      appList.applications.every((row) => row.id !== b.applicationId),
      "listEmployerApplications excludes another company's application",
    );
    assert(
      appList.total === 1,
      `listEmployerApplications total counts only own applications (got ${appList.total})`,
    );

    assert(
      (await employer.getEmployerApplication(a.companyId, b.applicationId)) === null,
      "getEmployerApplication returns null for another company's application",
    );

    const filtered = await employer.listEmployerApplications(a.companyId, { jobId: b.jobId });
    assert(
      filtered.applications.length === 0,
      "filtering by another company's jobId returns nothing rather than that job's applicants",
    );

    const stats = await employer.getEmployerDashboardStats(a.companyId);
    assert(stats.publishedCount === 1, `dashboard counts only own published jobs (got ${stats.publishedCount})`);
    assert(
      stats.applicationCount === 1,
      `dashboard counts only own applications (got ${stats.applicationCount})`,
    );

    // -----------------------------------------------------------------------
    // Writes: A's mutations against B's rows must affect zero rows, and B's
    // data must be byte-for-byte unchanged afterwards.
    // -----------------------------------------------------------------------
    console.log('\nwrites');

    const updatedForeignJob = await employer.updateEmployerJob(a.companyId, actor, b.jobId, {
      title: 'HIJACKED',
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'hijacked',
      whatsapp: null,
    });
    assert(updatedForeignJob === false, "updateEmployerJob reports no change on another company's job");

    const [jobAfter] = await db
      .select({ title: schema.jobs.title, status: schema.jobs.status })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, b.jobId));
    assert(jobAfter.title !== 'HIJACKED', "another company's job title is unchanged on disk");
    assert(jobAfter.status === 'published', "another company's job status is unchanged on disk");

    const updatedForeignApp = await employer.setEmployerApplicationStatus(
      a.companyId,
      actor,
      b.applicationId,
      'discarded',
    );
    assert(
      updatedForeignApp === false,
      "setEmployerApplicationStatus reports no change on another company's application",
    );

    const [appAfter] = await db
      .select({ status: schema.applications.status })
      .from(schema.applications)
      .where(eq(schema.applications.id, b.applicationId));
    assert(appAfter.status === 'new', "another company's application status is unchanged on disk");

    // -----------------------------------------------------------------------
    // The positive control. Without this, every assertion above would also
    // pass if the functions simply returned nothing at all.
    // -----------------------------------------------------------------------
    console.log('\npositive control (own data still works)');

    assert((await employer.getEmployerJob(a.companyId, a.jobId)) !== null, 'own job is readable');
    assert(
      (await employer.getEmployerApplication(a.companyId, a.applicationId)) !== null,
      'own application is readable',
    );
    assert(
      (await employer.setEmployerApplicationStatus(a.companyId, actor, a.applicationId, 'reviewed')) ===
        true,
      'own application status is writable',
    );

    // -----------------------------------------------------------------------
    // A created job must be pending and must belong to the caller's company,
    // whatever the input said.
    // -----------------------------------------------------------------------
    console.log('\ncreate defaults');

    const newJobId = await employer.createEmployerJob(a.companyId, actor, {
      title: `${FIXTURE_PREFIX} Nuevo puesto`,
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'fixture',
      whatsapp: null,
    });
    const [created] = await db
      .select({
        companyId: schema.jobs.companyId,
        status: schema.jobs.status,
        featuredUntil: schema.jobs.featuredUntil,
        publishedAt: schema.jobs.publishedAt,
      })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, newJobId));
    assert(created.companyId === a.companyId, 'created job belongs to the calling company');
    assert(created.status === 'pending', 'created job is pending, never published');
    assert(created.featuredUntil === null, 'created job is not featured');
    assert(created.publishedAt === null, 'created job has no publishedAt');

    // Editing a published job sends it back for review.
    await db
      .update(schema.jobs)
      .set({ status: 'published', publishedAt: now })
      .where(and(eq(schema.jobs.id, a.jobId), eq(schema.jobs.companyId, a.companyId)));
    await employer.updateEmployerJob(a.companyId, actor, a.jobId, {
      title: `${FIXTURE_PREFIX} Puesto a editado`,
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'edited',
      whatsapp: null,
    });
    const [edited] = await db
      .select({ status: schema.jobs.status, slug: schema.jobs.slug })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, a.jobId));
    assert(edited.status === 'pending', 'editing a published job returns it to pending');
    assert(edited.slug === `${FIXTURE_PREFIX}a-job`, 'editing does not change the slug (live SEO URL)');

    // Material-change rule (PLAN-PHASE2.md §6.1): a non-strict field
    // (whatsapp) on a published job applies live and does NOT re-queue it.
    await db
      .update(schema.jobs)
      .set({ status: 'published', publishedAt: now })
      .where(and(eq(schema.jobs.id, a.jobId), eq(schema.jobs.companyId, a.companyId)));
    await employer.updateEmployerJob(a.companyId, actor, a.jobId, {
      title: `${FIXTURE_PREFIX} Puesto a editado`,
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'edited',
      whatsapp: '595981000111',
    });
    const [whatsappEdited] = await db
      .select({ status: schema.jobs.status, whatsapp: schema.jobs.whatsapp, publishedAt: schema.jobs.publishedAt })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, a.jobId));
    assert(
      whatsappEdited.status === 'published',
      'editing only whatsapp on a published job keeps it published',
    );
    assert(whatsappEdited.whatsapp === '595981000111', 'the whatsapp edit was actually applied');
    assert(whatsappEdited.publishedAt !== null, 'publishedAt is preserved when the job stays published');

    // A strict field (title) on the same published job DOES re-queue it.
    await employer.updateEmployerJob(a.companyId, actor, a.jobId, {
      title: `${FIXTURE_PREFIX} Puesto a re-editado`,
      categoryId: category.id,
      cityId: city.id,
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: null,
      salaryMax: null,
      salaryHidden: true,
      description: 'edited',
      whatsapp: '595981000111',
    });
    const [titleEdited] = await db
      .select({ status: schema.jobs.status })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, a.jobId));
    assert(
      titleEdited.status === 'pending',
      'editing title on a published job returns it to pending (material change)',
    );
  } finally {
    await cleanup();
    console.log('\nFixtures removed.');
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) FAILED.`);
    process.exit(1);
  }
  console.log('\nAll scoping assertions passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
