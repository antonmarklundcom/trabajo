// Creates a candidate account from the command line.
//
//   npm run candidate:create -- --email a@b.py --name "Ana" --phone 0981234567
//
// This exists for LOCAL DEVELOPMENT AND TESTING of the candidate auth surface
// before the signup UI lands (PR 8). It is not the production path: a real
// candidate account is created by the person themselves, through a form that
// records their explicit consent (PLAN-PHASE2.md §4.1).
//
// That is why this script writes a `consents` row too, with a policy_version of
// "script" and granted = true. Not because a command-line flag is consent — it
// obviously is not — but because a candidate row with no consent row is an
// impossible state in production, and test data that models an impossible state
// hides bugs in every query that assumes the pair exists. The marker makes such
// rows trivially greppable, and refusing to run against a non-local database
// keeps them out of production entirely.
//
// The password is prompted for, never passed as an argument: argv lands in
// shell history and in the process list.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import { promptNewPassword } from './prompt-password';

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

const USAGE = `
Usage: npm run candidate:create -- --email <email> --name <name> --phone <phone> [--city-id <id>] [--force]

Local development only. Refuses to run against a non-local DATABASE_URL unless
--force is passed. The password is prompted for interactively.
`.trim();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const phone = args.phone?.trim();
  const cityId = args['city-id'] ? Number(args['city-id']) : null;

  if (!email || !name || !phone) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" does not look like an email address.`);
    process.exit(1);
  }
  if (args['city-id'] && Number.isNaN(cityId)) {
    console.error('--city-id must be a number.');
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);

  if (!isLocal(url) && args.force !== 'true') {
    console.error(
      '\nRefusing to create a test candidate against a non-local database.\n' +
        'Candidate accounts in production are created by the candidate, with recorded consent.\n' +
        'Pass --force only if you genuinely mean to write to this database.',
    );
    process.exit(1);
  }

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const existing = await db
    .select({ id: schema.candidates.id })
    .from(schema.candidates)
    .where(eq(schema.candidates.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`A candidate with email ${email} already exists (id ${existing[0].id}).`);
    process.exit(1);
  }

  const password = await promptNewPassword();

  // bcrypt directly rather than via lib/auth-candidate: that module imports
  // `server-only`, which throws outside a Next server context. Cost 12 matches.
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash(password, 12);

  const now = new Date();
  const [result] = await db.insert(schema.candidates).values({
    email,
    name,
    phone,
    cityId,
    passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.consents).values({
    subjectType: 'candidate',
    subjectId: result.insertId,
    purpose: 'profile_storage',
    granted: true,
    policyVersion: 'script',
    createdAt: now,
  });

  console.log(`Created candidate "${name}" <${email}> (id ${result.insertId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
