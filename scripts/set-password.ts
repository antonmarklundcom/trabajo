// Resets an admin-panel user's password. This is the password-reset flow in
// v1 — there is deliberately no self-serve reset until employer accounts land
// (ARCHITECTURE.md §5).
//
//   npm run user:password -- --email ana@trabajo.com.py
//
// The password is read from stdin (hidden), or from USER_PASSWORD if set.
import './require-db-url';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { hashPassword, normalizeEmail } from '../lib/password';
import { readPassword } from './read-password';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const emailInput = arg('email');
  if (!emailInput) {
    console.error('Usage: npm run user:password -- --email <email>');
    process.exit(1);
  }

  const email = normalizeEmail(emailInput);
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }

  const password = await readPassword('New password (min 12 chars): ');
  const passwordHash = await hashPassword(password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  console.log(`Password updated for ${email}. Existing sessions stay valid until they expire.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
