// Changes an existing user's password. This is the v1 password-reset flow
// (ARCHITECTURE.md §5): an admin runs it out of band. Self-serve reset arrives
// with employer accounts, not before.
//
//   npm run user:password -- --email a@b.py
//
// Can also re-enable an account that was disabled via /admin/usuarios:
//
//   npm run user:password -- --email a@b.py --activate
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
Usage: npm run user:password -- --email <email> [--activate]

  --activate   also set is_active = true, re-enabling a disabled account

The new password is prompted for interactively.
`.trim();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const activate = args.activate === 'true';

  if (!email) {
    console.error(USAGE);
    process.exit(1);
  }

  const url = requireDatabaseUrl();
  console.log(`Target: ${describeTarget(url)}`);

  const { db } = await import('../lib/db');
  const schema = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user) {
    console.error(`No user with email ${email}.`);
    console.error('Create one with: npm run user:create -- --email ' + email + ' --name "..." --role admin');
    process.exit(1);
  }

  console.log(`User: ${user.name} <${email}> (${user.role})${user.isActive ? '' : ' — DISABLED'}`);
  if (!user.isActive && !activate) {
    console.log('This account is disabled. Pass --activate to re-enable it as well.');
  }

  const password = await promptNewPassword();

  // bcrypt directly rather than lib/auth: that module imports `server-only`,
  // which throws outside a Next server context. Cost 12 matches lib/auth.
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(schema.users)
    .set({
      passwordHash,
      updatedAt: new Date(),
      ...(activate ? { isActive: true } : {}),
    })
    .where(eq(schema.users.id, user.id));

  console.log(`Password updated for ${email}${activate ? ' (account activated)' : ''}.`);
  console.log('Existing sessions stay valid — the cookie holds only a user id.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
