// Creates an admin-panel user. There is no self-serve signup and no password
// reset flow in v1 (ARCHITECTURE.md §5) — accounts are created here.
//
//   npm run user:create -- --email ana@trabajo.com.py --name "Ana" --role admin
//
// The password is read from stdin (hidden) so it never lands in shell history.
// For non-interactive use, set USER_PASSWORD in the environment instead.
import './require-db-url';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { hashPassword, normalizeEmail } from '../lib/password';
import { readPassword } from './read-password';

const ROLES = ['admin', 'editor', 'employer'] as const;
type Role = (typeof ROLES)[number];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function usage(message: string): never {
  console.error(`${message}

Usage:
  npm run user:create -- --email <email> --name "<name>" --role <admin|editor|employer> [--company-id <id>]

Password: entered at the prompt, or taken from USER_PASSWORD if set.`);
  process.exit(1);
}

async function main() {
  const emailInput = arg('email');
  const name = arg('name');
  const role = arg('role') as Role | undefined;
  const companyIdArg = arg('company-id');

  if (!emailInput) usage('--email is required.');
  if (!name) usage('--name is required.');
  if (!role || !ROLES.includes(role)) usage(`--role must be one of: ${ROLES.join(', ')}.`);
  if (role === 'employer' && !companyIdArg) {
    usage('--company-id is required for the employer role.');
  }

  const email = normalizeEmail(emailInput);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.error(`A user with ${email} already exists (id ${existing.id}). Use set-password to change its password.`);
    process.exit(1);
  }

  const password = await readPassword('Password (min 12 chars): ');
  const passwordHash = await hashPassword(password);

  const now = new Date();
  await db.insert(users).values({
    email,
    name,
    role,
    companyId: companyIdArg ? Number(companyIdArg) : null,
    passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Created ${role} ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
