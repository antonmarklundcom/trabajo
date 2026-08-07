// Creates an admin-panel user. There is no self-serve signup and no password
// reset flow in v1 (ARCHITECTURE.md §5), so this script and set-password.ts
// are how accounts come into existence.
//
//   npm run user:create -- --email a@b.py --name "Ana" --role admin
//
// The password is prompted for, never passed as an argument: argv lands in
// shell history and in the process list.
import { requireDatabaseUrl, describeTarget } from './require-db-url';
import { promptNewPassword } from './prompt-password';

const ROLES = ['admin', 'editor', 'employer'] as const;
type Role = (typeof ROLES)[number];

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
Usage: npm run user:create -- --email <email> --name <name> --role <${ROLES.join('|')}> [--company-id <id>]

The password is prompted for interactively.
`.trim();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const role = args.role as Role | undefined;
  const companyId = args['company-id'] ? Number(args['company-id']) : null;

  if (!email || !name || !role) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" does not look like an email address.`);
    process.exit(1);
  }
  if (args['company-id'] && Number.isNaN(companyId)) {
    console.error('--company-id must be a number.');
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`A user with email ${email} already exists (id ${existing[0].id}).`);
    console.error('Use `npm run user:password -- --email ' + email + '` to change its password.');
    process.exit(1);
  }

  const password = await promptNewPassword();

  // Imported here rather than at the top: lib/auth pulls in `server-only`,
  // which throws outside a Next server context. bcrypt is used directly.
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash(password, 12);

  const now = new Date();
  await db.insert(schema.users).values({
    email,
    name,
    role,
    companyId,
    passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Created ${role} "${name}" <${email}>.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
