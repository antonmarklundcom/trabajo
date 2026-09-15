// Fixed LOCAL test fixtures, separate from the production-capable catalog import.
// Run after npm run db:seed:
//   npx tsx --env-file-if-exists=.env scripts/seed-test-data.ts
// All three accounts use the test-only password Trabajo-test-2026!.
// Run once: existing fixture emails cause a failure BEFORE any writes. The
// transaction rolls back all fixtures on failure; reruns never duplicate them.
// Image keys are placeholders only: requests for their bytes will return 404.
// Catalog jobs retain their imported status; use the employer account to submit
// a new pending job when smoke-testing the admin approval queue.
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, describeTarget } from './require-db-url';

const accounts = [
  { email: 'seed-admin@example.test', name: 'Administración de prueba', role: 'admin' },
  { email: 'seed-employer@example.test', name: 'Empresa de prueba', role: 'employer' },
] as const;
const candidate = {
  email: 'seed-candidate@example.test',
  name: 'Postulante de prueba',
  phone: '0981000000',
};
const jobSlugs = ['contador-senior-empresa-xyz', 'auxiliar-contable-kia-paraguay'] as const;

async function main() {
  const url = requireDatabaseUrl();
  // Same local-only boundary as create-candidate.ts, with no force override:
  // these accounts have fixed, publicly known test credentials.
  if (!new Set(['localhost', '127.0.0.1', '[::1]', '::1']).has(new URL(url).hostname)) {
    throw new Error('Refusing to seed test accounts against a non-local database.');
  }
  console.log(`Seeding fixed test data into ${describeTarget(url)} ...`);

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  // Match create-user.ts and create-candidate.ts: bcrypt directly, cost 12,
  // avoiding the server-only auth modules in a standalone CLI.
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash('Trabajo-test-2026!', 12);

  await db.transaction(async (tx) => {
    const existingUsers = await tx.select({ id: schema.users.id }).from(schema.users)
      .where(inArray(schema.users.email, accounts.map((account) => account.email)));
    const existingCandidates = await tx.select({ id: schema.candidates.id }).from(schema.candidates)
      .where(eq(schema.candidates.email, candidate.email));
    if (existingUsers.length || existingCandidates.length) {
      throw new Error('Test fixture accounts already exist. seed-test-data.ts is run-once; no data was written.');
    }

    const seededJobs = await tx.select().from(schema.jobs)
      .where(inArray(schema.jobs.slug, [...jobSlugs]));
    const firstJob = seededJobs.find((job) => job.slug === jobSlugs[0]);
    const secondJob = seededJobs.find((job) => job.slug === jobSlugs[1]);
    if (!firstJob || !secondJob) {
      throw new Error('Required catalog jobs are missing. Run npm run db:seed first.');
    }
    const [company] = await tx.select({ id: schema.companies.id }).from(schema.companies)
      .where(eq(schema.companies.id, firstJob.companyId));
    if (!company) throw new Error('The seeded job company is missing. Run npm run db:seed first.');

    const now = new Date();
    for (const account of accounts) {
      await tx.insert(schema.users).values({
        ...account,
        companyId: company.id,
        passwordHash,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [createdCandidate] = await tx.insert(schema.candidates).values({
      ...candidate,
      cityId: firstJob.cityId,
      passwordHash,
      isActive: true,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const candidateId = createdCandidate.insertId;
    // Match create-candidate.ts's explicit synthetic consent marker. Append
    // only; the application also records its own employer/job-scoped consent.
    await tx.insert(schema.consents).values({
      subjectType: 'candidate', subjectId: candidateId,
      purpose: 'profile_storage', granted: true, policyVersion: 'script', createdAt: now,
    });
    const [sharingConsent] = await tx.insert(schema.consents).values({
      subjectType: 'candidate', subjectId: candidateId,
      purpose: 'application_share', granted: true, policyVersion: 'script',
      relatedCompanyId: company.id, relatedJobId: firstJob.id, createdAt: now,
    });
    await tx.insert(schema.applications).values({
      jobId: firstJob.id,
      candidateId,
      consentId: sharingConsent.insertId,
      ...candidate,
      message: 'Postulación de prueba para verificar el portal.',
      sourcePage: `/empleos/${firstJob.slug}`,
      status: 'new',
      createdAt: now,
    });

    for (const [index, job] of [firstJob, secondJob].entries()) {
      const imageKey = `img/jobs/00000000-0000-4000-8000-00000000000${index + 1}.webp`;
      // job_images has no unique key on job/image. Reuse any placeholder left
      // after manually removing fixture accounts rather than duplicating it.
      const [existingImage] = await tx.select({ id: schema.jobImages.id }).from(schema.jobImages)
        .where(and(eq(schema.jobImages.jobId, job.id), eq(schema.jobImages.imageKey, imageKey)));
      if (!existingImage) {
        await tx.insert(schema.jobImages).values({
          jobId: job.id, imageKey, width: 1200, height: 800, sortOrder: 0, createdAt: now,
        });
      }
    }
  });

  console.log('Created 2 users, 1 candidate, 1 application and 2 placeholder job images.');
  console.log('Test logins: seed-admin@example.test, seed-employer@example.test, seed-candidate@example.test');
  console.log('Test-only password for all three: Trabajo-test-2026!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
