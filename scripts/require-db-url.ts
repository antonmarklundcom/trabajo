// Guard imported first by every script that talks to MySQL.
//
// `drizzle-kit` auto-loads `.env`; plain `tsx` does NOT (DEPLOY.md). Without
// this guard a script with an undefined DATABASE_URL lets mysql2 silently fall
// back to localhost and fail with a bare ECONNREFUSED, which reads like a
// server problem instead of a missing env var.
//
// Import it before anything that pulls in `lib/db` — ES modules evaluate in
// import-statement order, so the check runs before the pool is constructed.
import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && existsSync('.env')) {
  // Node >= 20.12. Mirrors what drizzle-kit does for itself.
  process.loadEnvFile('.env');
}

if (!process.env.DATABASE_URL) {
  console.error(
    [
      'DATABASE_URL is not set.',
      '',
      'tsx does not auto-load .env, so scripts need it in the shell session:',
      '',
      '  PowerShell:  $env:DATABASE_URL = "mysql://user:pass@host:3306/dbname"',
      '  bash/zsh:    export DATABASE_URL="mysql://user:pass@host:3306/dbname"',
      '',
      'Or put it in a .env file at the repo root and this script will load it.',
      'Hostinger remote MySQL host/port come from hPanel -> Databases ->',
      'Remote MySQL, and differ from the "localhost" the live app uses. Your',
      'current public IP must be allowlisted there. See DEPLOY.md.',
    ].join('\n'),
  );
  process.exit(1);
}
