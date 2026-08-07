// Shared preflight for every script that talks to MySQL.
//
// `lib/db/index.ts` builds its pool at module-evaluation time, so a missing
// DATABASE_URL surfaces there as a bare "DATABASE_URL is not set" stack trace
// with no hint about the most common cause: tsx does NOT read .env by itself
// (DEPLOY.md §"tsx and .env"). Every db:* npm script therefore passes
// --env-file-if-exists=.env, and every script calls this guard BEFORE importing
// anything under lib/db so the failure is a readable message instead.

const HELP = `
DATABASE_URL is not set.

The db:* scripts run under tsx, which does not load .env on its own. The npm
scripts pass --env-file-if-exists=.env for you, so the usual causes are:

  1. No .env file exists yet. Copy the template and fill in DATABASE_URL:
       cp .env.example .env
  2. .env exists but DATABASE_URL is empty or commented out.
  3. You invoked the script directly (tsx scripts/...) instead of via npm.
     Use: npm run db:migrate | db:seed | db:verify | db:parity
  4. One-off against a remote database, no .env involved:
       DATABASE_URL='mysql://user:pass@host:3306/dbname' npm run db:verify

Format: mysql://user:password@host:3306/dbname
Hostinger's remote host differs from the "localhost" the live app uses, and
remote access requires your IP in hPanel's Remote MySQL allowlist — see
DEPLOY.md before pointing these scripts at production.
`;

/**
 * Returns DATABASE_URL, or exits(1) with an actionable message. Call this at
 * the top of a script, before any `await import('../lib/db')`.
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === '') {
    console.error(HELP.trim());
    process.exit(1);
  }
  if (!/^mysql:\/\//.test(url)) {
    console.error(
      `DATABASE_URL does not look like a MySQL URL (expected mysql://...), got: ${url.slice(0, 12)}...\n` +
        'Format: mysql://user:password@host:3306/dbname',
    );
    process.exit(1);
  }
  return url;
}

/** Host + database of DATABASE_URL, with credentials stripped, for logging. */
export function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '3306'}${parsed.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}
