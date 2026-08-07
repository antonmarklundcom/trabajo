// Applies the SQL migrations in ./drizzle to DATABASE_URL.
//
// Deliberately not `drizzle-kit migrate`: drizzle-kit resolves DATABASE_URL
// through drizzle.config.ts at its own process start, which does not pick up
// the --env-file-if-exists=.env that the db:* scripts rely on. Running the
// migrator from tsx keeps env handling identical across every db:* script.
import { requireDatabaseUrl, describeTarget } from './require-db-url';

async function main() {
  const url = requireDatabaseUrl();
  console.log(`Migrating ${describeTarget(url)} ...`);

  // Imported after the guard — lib/db builds its pool at module evaluation.
  const { db } = await import('../lib/db');
  const { migrate } = await import('drizzle-orm/mysql2/migrator');

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations applied.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
