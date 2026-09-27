// Asserts the job-alert ("Avisame de empleos nuevos") non-negotiables:
//
//   npm run alerts:verify            (add `-- --print` to see the fixture emails)
//
// Every way this feature fails is invisible from a browser:
//
//   - an alert row without its consents row (or the reverse) looks exactly like
//     a correct subscribe until someone asks for the evidence;
//   - an unsubscribe that UPDATEs a consent, or flags the alert instead of
//     deleting it, still stops the emails;
//   - a GET that confirms or unsubscribes works perfectly — for the mail
//     scanner that prefetched the link;
//   - a sender that reads jobs around lib/data.ts mails an unapproved listing;
//   - a plaintext token in the table is a working unsubscribe/confirm link for
//     anyone who reads a backup.
//
// So each is checked twice where it can be: EXECUTED against a fake mysql2
// pool that records every statement (no database — the SQL drizzle would send
// is what gets asserted), and READ from source for the properties that are
// about what a file may contain. Runs under `--conditions=react-server` so the
// `server-only` imports resolve to their no-op build.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Source with comments removed; keeps `https://` inside strings. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
}

/** The body of `function <name>(` up to the column-0 closing brace. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.search(/\n\}[ \t]*(\n|$)/);
  return end === -1 ? rest : rest.slice(0, end);
}

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((entry) => {
    const rel = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

// ---------------------------------------------------------------------------
// The fake pool. lib/db/index.ts reuses `globalThis.dbPool` when one is set,
// so installing this BEFORE the first import of a lib/db module routes every
// query here. Selects answer from `selectRows` (set per scenario); writes
// answer one affected row.
// ---------------------------------------------------------------------------

/**
 * `via` is which object ran the statement: the pooled connection a drizzle
 * transaction holds ('conn'), or the pool itself ('pool'). A `db.insert()`
 * written inside a transaction callback runs on the pool — a different
 * connection, outside the transaction — and this is how that is told apart.
 */
type Stmt = { sql: string; params: unknown[]; via: 'conn' | 'pool' };
let statements: Stmt[] = [];
let selectRows: unknown[][] = [];

function respond(via: Stmt['via'], q: unknown, params: unknown): Promise<unknown> {
  const sql = typeof q === 'string' ? q : (q as { sql: string }).sql;
  statements.push({ sql, params: Array.isArray(params) ? params : [], via });
  if (/^\s*select/i.test(sql)) {
    const rowsAsArray = typeof q === 'object' && q !== null && (q as { rowsAsArray?: boolean }).rowsAsArray;
    return Promise.resolve([rowsAsArray ? selectRows : [], []]);
  }
  return Promise.resolve([{ affectedRows: 1, insertId: 4242 }, []]);
}
const connection = {
  query: (q: unknown, p: unknown) => respond('conn', q, p),
  execute: (q: unknown, p: unknown) => respond('conn', q, p),
  beginTransaction: async () => void statements.push({ sql: 'begin', params: [], via: 'conn' }),
  commit: async () => void statements.push({ sql: 'commit', params: [], via: 'conn' }),
  rollback: async () => void statements.push({ sql: 'rollback', params: [], via: 'conn' }),
  release: () => {},
};
(globalThis as unknown as { dbPool: unknown }).dbPool = {
  query: (q: unknown, p: unknown) => respond('pool', q, p),
  execute: (q: unknown, p: unknown) => respond('pool', q, p),
  getConnection: async () => connection,
};
process.env.DATABASE_URL = 'mysql://verify:verify@127.0.0.1:1/verify';
process.env.NEXT_PUBLIC_SITE_URL = 'https://trabajo.com.py';

const SECRET = 'verify-secret-verify-secret-verify-secret';

/** Index of the first statement matching `re`, or -1. */
function at(list: Stmt[], re: RegExp): number {
  return list.findIndex((s) => re.test(s.sql));
}

const isBegin = (s: Stmt) => /^\s*(begin|start transaction)\b/i.test(s.sql);
const isCommit = (s: Stmt) => /^\s*commit\b/i.test(s.sql);

/**
 * True when statement `i` sits between a BEGIN and the COMMIT that closes it.
 * (drizzle issues `begin`/`commit` as queries on the connection; the
 * beginTransaction() path is covered too.)
 */
function insideTransaction(list: Stmt[], i: number): boolean {
  if (i === -1 || list[i].via !== 'conn') return false;
  let begin = -1;
  for (let j = i - 1; j >= 0; j -= 1) {
    if (isBegin(list[j])) {
      begin = j;
      break;
    }
  }
  const commit = list.findIndex((s, j) => j > i && isCommit(s));
  const commitBetween = list.slice(begin + 1, i).some(isCommit);
  return begin !== -1 && commit !== -1 && !commitBetween;
}

async function main() {
  const {
    JOB_ALERT_MAX_JOBS,
    alertSkipReason,
    alertWindowStart,
    canStopPaging,
    parseAlertArgs,
    selectNewJobs,
  } = await import('../lib/job-alerts');
  const { hashJobAlertToken, jobAlertToken, isWellFormedJobAlertToken } = await import('../lib/job-alert-token');
  const alertsDb = await import('../lib/db/job-alerts');
  const retention = await import('../lib/db/retention');
  const { jobAlertConfirmationMessage, jobAlertDigestMessage } = await import('../lib/emails/job-alerts');
  const { isTrackablePath } = await import('../lib/analytics-location');
  const { categoryLabel } = await import('../lib/labels');
  type Job = import('../lib/types').Job;

  // -------------------------------------------------------------------------
  // 1. Subscribe: alert INSERT and consents INSERT in ONE transaction.
  // -------------------------------------------------------------------------
  statements = [];
  selectRows = [];
  const sub = await alertsDb.subscribeJobAlert({
    email: '  Persona@Ejemplo.COM ',
    categorySlug: 'ventas',
    citySlug: 'asuncion',
    ip: '203.0.113.9',
    userAgent: 'x'.repeat(400),
    secret: SECRET,
  });
  const insAlert = at(statements, /^insert into `job_alerts`/i);
  const insConsent = at(statements, /^insert into `consents`/i);
  const consentInserts = statements
    .map((st, i) => (/^insert into `consents`/i.test(st.sql) ? i : -1))
    .filter((i) => i !== -1);
  check(
    'subscribe inserts the alert and its consent inside the same transaction',
    insAlert !== -1 &&
      insConsent !== -1 &&
      consentInserts.length === 1 &&
      consentInserts.every((i) => insideTransaction(statements, i)) &&
      insideTransaction(statements, insAlert) &&
      insideTransaction(statements, insConsent) &&
      !statements.slice(insAlert, insConsent).some(isCommit),
    statements.map((s) => s.sql.slice(0, 40)).join(' | '),
  );
  const consentParams = insConsent === -1 ? [] : statements[insConsent].params;
  check(
    'the subscribe consent is a granted row for subject job_alert / purpose job_alerts',
    consentParams.includes('job_alert') && consentParams.includes('job_alerts') && consentParams.includes(true),
    JSON.stringify(consentParams),
  );
  check(
    'the consent row fits consents.user_agent (varchar 255)',
    consentParams.some((p) => typeof p === 'string' && /^x+$/.test(p) && p.length === 255),
  );
  check(
    'the address is stored lowercased and trimmed',
    insAlert !== -1 && statements[insAlert].params.includes('persona@ejemplo.com'),
  );

  // -------------------------------------------------------------------------
  // 2. The token: derived, never stored; only its sha256 is.
  // -------------------------------------------------------------------------
  const rawToken = sub.action === 'send' ? sub.token : '';
  const everyParam = statements.flatMap((s) => s.params).map(String);
  check('subscribe returns a token to mail', isWellFormedJobAlertToken(rawToken));
  check(
    'the raw token never reaches the database',
    rawToken !== '' && !everyParam.some((p) => p.includes(rawToken)),
  );
  check(
    'its sha256 is what token_hash is set to',
    rawToken !== '' &&
      statements.some(
        (s) => /^update `job_alerts` set `token_hash`/i.test(s.sql) && s.params.includes(hashJobAlertToken(rawToken)),
      ),
  );
  check(
    'the token is sha256-hashed (64 hex), matching token_hash char(64)',
    hashJobAlertToken('abc') === createHash('sha256').update('abc').digest('hex') &&
      /char\('token_hash', \{ length: 64 \}\)/.test(read('lib/db/schema.ts')),
  );
  check(
    'the token depends on the secret, the id and the address',
    jobAlertToken(1, 'a@b.py', SECRET) !== jobAlertToken(1, 'a@b.py', `${SECRET}x`) &&
      jobAlertToken(1, 'a@b.py', SECRET) !== jobAlertToken(2, 'a@b.py', SECRET) &&
      jobAlertToken(1, 'a@b.py', SECRET) !== jobAlertToken(1, 'c@b.py', SECRET) &&
      jobAlertToken(1, 'A@B.py ', SECRET) === jobAlertToken(1, 'a@b.py', SECRET),
  );
  {
    const schemaAlerts = code(read('lib/db/schema.ts'));
    const start = schemaAlerts.indexOf("mysqlTable(\n  'job_alerts'");
    const block = schemaAlerts.slice(start, schemaAlerts.indexOf('\n);', start));
    check(
      'job_alerts has no column that could hold a raw token',
      start !== -1 && !/\('token'|\('raw_token'|\('unsubscribe_token'/.test(block),
    );
    const dbSource = code(read('lib/db/job-alerts.ts'));
    const tokenHashWrites = [...dbSource.matchAll(/tokenHash:\s*([^,\n]+)/g)].map((m) => m[1].trim());
    check(
      'every token_hash write in lib/db/job-alerts.ts is a hash',
      tokenHashWrites.length > 0 &&
        tokenHashWrites.every((w) => w.startsWith('placeholderTokenHash(') || w.startsWith('hashJobAlertToken(')),
      tokenHashWrites.join(' ; '),
    );
    check(
      'every token lookup compares the hash',
      /eq\(jobAlerts\.tokenHash, tokenHash\)/.test(dbSource) &&
        !/eq\(jobAlerts\.tokenHash, rawToken\)/.test(dbSource) &&
        [...dbSource.matchAll(/const tokenHash = ([^;]+);/g)].every((m) => m[1].startsWith('hashJobAlertToken(')),
    );
  }

  // -------------------------------------------------------------------------
  // 3. Unsubscribe: DELETE the alert + INSERT a granted=false consent; one
  //    transaction; never an UPDATE of consents.
  // -------------------------------------------------------------------------
  statements = [];
  selectRows = [[4242]];
  const removed = await alertsDb.unsubscribeJobAlert(rawToken, { ip: '203.0.113.9', userAgent: 'UA' });
  const del = at(statements, /^delete from `job_alerts`/i);
  const withdraw = at(statements, /^insert into `consents`/i);
  check('unsubscribe reports the alert removed', removed === true);
  check(
    'unsubscribe hard-DELETEs the alert and appends a consent row in one transaction',
    del !== -1 && withdraw !== -1 && insideTransaction(statements, del) && insideTransaction(statements, withdraw),
    statements.map((s) => s.sql.slice(0, 40)).join(' | '),
  );
  check(
    'the unsubscribe consent row is granted=false',
    withdraw !== -1 && statements[withdraw].params.includes(false) && !statements[withdraw].params.includes(true),
  );
  check(
    'unsubscribe never UPDATEs anything',
    !statements.some((s) => /^update /i.test(s.sql)),
    statements.filter((s) => /^update /i.test(s.sql)).map((s) => s.sql).join(' | '),
  );

  // -------------------------------------------------------------------------
  // 4. The retention sweep ends an alert the same way.
  // -------------------------------------------------------------------------
  statements = [];
  selectRows = [[7], [8]];
  await retention.deleteJobAlerts([7, 8], new Date('2026-09-27T00:00:00Z'));
  const sweepDel = at(statements, /^delete from `job_alerts`/i);
  const sweepIns = at(statements, /^insert into `consents`/i);
  check(
    'the sweep DELETEs alerts and appends granted=false consents in one transaction',
    sweepDel !== -1 &&
      sweepIns !== -1 &&
      insideTransaction(statements, sweepDel) &&
      insideTransaction(statements, sweepIns) &&
      statements[sweepIns].params.filter((p) => p === false).length === 2,
    statements.map((s) => s.sql.slice(0, 40)).join(' | '),
  );
  check('the sweep never UPDATEs anything', !statements.some((s) => /^update /i.test(s.sql)));

  // Repo-wide: consents is append-only, and no alert soft-delete flag exists.
  {
    const files = [...walk('lib'), ...walk('app'), ...walk('scripts')].filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('verify-alerts.ts'),
    );
    const updaters = files.filter((f) => /\.update\(consents\)/.test(code(read(f))));
    check('nothing anywhere UPDATEs consents', updaters.length === 0, updaters.join(', '));
    const alertUpdates = files.flatMap((f) =>
      [...code(read(f)).matchAll(/\.update\(jobAlerts\)\s*\.set\(\{([^}]*)\}/g)].map((m) => `${f}: ${m[1].trim()}`),
    );
    const allowedSets = /^(tokenHash|confirmedAt|confirmationSentAt|lastSentAt):/;
    check(
      'job_alerts is only ever UPDATEd for its token hash or its three timestamps (no deleted/active flag)',
      alertUpdates.length > 0 &&
        alertUpdates.every((u) => allowedSets.test(u.split(': ').slice(1).join(': '))),
      alertUpdates.join(' ; '),
    );
    const schemaSource = read('lib/db/schema.ts');
    const start = schemaSource.indexOf("mysqlTable(\n  'job_alerts'");
    const block = schemaSource.slice(start, schemaSource.indexOf('\n);', start));
    check(
      'job_alerts has no soft-delete / active column',
      start !== -1 && !/deleted|is_active|active|unsubscribed|disabled/i.test(code(block).replace(/\/\/.*$/gm, '')),
    );
  }

  // -------------------------------------------------------------------------
  // 5. The link pages and routes: no write on GET.
  // -------------------------------------------------------------------------
  {
    const pages = walk('app/alertas').filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
    check('found the two link pages', pages.length >= 2, pages.join(', '));
    for (const page of pages) {
      const src = code(read(page));
      check(
        `${page} imports no database module and issues no request`,
        !/lib\/db\//.test(src) && !/from '@\/lib\/db'/.test(src) && !/\bfetch\(/.test(src),
      );
    }
    const routes = walk('app/api/alertas').filter((f) => f.endsWith('route.ts'));
    check('found the three alert routes', routes.length === 3, routes.join(', '));
    for (const route of routes) {
      const src = code(read(route));
      check(
        `${route} exports POST only (a prefetched GET cannot write)`,
        /export async function POST\(/.test(src) && !/export (async )?function (GET|HEAD)\b/.test(src) && !/export const (GET|HEAD)\b/.test(src),
      );
    }
    const action = code(read('components/JobAlertLinkAction.tsx'));
    check(
      'the link button POSTs on click, never from an effect on mount',
      /onClick=\{run\}/.test(action) && !/useEffect/.test(action) && /method: 'POST'/.test(action),
    );
    const unsubscribeRoute = code(read('app/api/alertas/baja/route.ts'));
    const unsubscribePage = code(read('app/alertas/baja/page.tsx'));
    check(
      'unsubscribe is never gated by the feature flag',
      !/jobAlertsEnabled/.test(unsubscribeRoute) && !/jobAlertsEnabled/.test(unsubscribePage),
    );
    check(
      'subscribe and confirm are gated by the feature flag',
      /jobAlertsEnabled\(\)/.test(code(read('app/api/alertas/route.ts'))) &&
        /jobAlertsEnabled\(\)/.test(code(read('app/api/alertas/confirmar/route.ts'))) &&
        /jobAlertsEnabled\(\)/.test(code(read('app/alertas/confirmar/page.tsx'))),
    );
    check(
      '/alertas pages carry a token and are never measured by GA',
      !isTrackablePath('/alertas/confirmar') && !isTrackablePath('/alertas/baja'),
    );
    const subscribe = code(read('app/api/alertas/route.ts'));
    check(
      'the subscribe route runs the honeypot and the shared public rate limiter before any write',
      subscribe.indexOf('isHoneypotFilled(') !== -1 &&
        subscribe.indexOf('isRateLimited(ip)') !== -1 &&
        subscribe.indexOf('isHoneypotFilled(') < subscribe.indexOf('subscribeJobAlert(') &&
        subscribe.indexOf('isRateLimited(ip)') < subscribe.indexOf('subscribeJobAlert('),
    );
    check(
      'the subscribe route validates the filter through lib/data.ts',
      /from '@\/lib\/data'/.test(subscribe) && /getCategory\(/.test(subscribe) && /getCity\(/.test(subscribe),
    );
    const form = code(read('components/JobAlertForm.tsx'));
    check(
      'the form reuses lead_submit with a typed lead_type (no third event name, no cast around track)',
      /track\('lead_submit', \{ lead_type: 'seeker', channel: 'form' \}\)/.test(form) &&
        (form.match(/\btrack\b/g) ?? []).length === 2 &&
        !/\btrack\s+as\b/.test(form),
      'Expected exactly the import and one typed call.',
    );
  }

  // -------------------------------------------------------------------------
  // 6. The sender: jobs through lib/data.ts only; dry run by default; stamp
  //    only after a successful send.
  // -------------------------------------------------------------------------
  {
    const script = code(read('scripts/job-alerts.ts'));
    check(
      'the sender reads jobs through lib/data.ts getJobs()',
      /await import\('\.\.\/lib\/data'\)/.test(script) && /\bgetJobs\(/.test(script),
    );
    check(
      'the sender never reads the catalogue around the seam',
      !/lib\/db\/queries|lib\/seed|from '\.\.\/lib\/db\/schema'|\bjobs\.json/.test(script),
    );
    const dbModule = code(read('lib/db/job-alerts.ts'));
    check(
      'lib/db/job-alerts.ts touches only job_alerts and consents (no jobs, no candidates)',
      /import \{ consents, jobAlerts \} from '\.\/schema'/.test(dbModule) &&
        !/\bjobs\b\s*[,}]|candidates|applications/.test(dbModule.slice(0, dbModule.indexOf("from './schema'") + 20)),
    );
    check(
      'the due list selects confirmed alerts only',
      /isNotNull\(jobAlerts\.confirmedAt\)/.test(functionBody(dbModule, 'listDueJobAlerts')),
    );

    check('no flag means dry run', parseAlertArgs([]).apply === false);
    check('--apply means apply', parseAlertArgs(['--apply']).apply === true);
    check(
      'unknown flags are rejected, not ignored',
      parseAlertArgs(['--aply']).unknown.join() === '--aply' && parseAlertArgs(['--aply']).apply === false,
    );
    const dryGate = script.indexOf('if (!apply) continue;');
    const sendAt = script.indexOf('await sendEmail(');
    const stampAt = script.indexOf('await markJobAlertSent(');
    const sentGuard = script.indexOf('if (result.sent)');
    check(
      'no send happens before the dry-run gate',
      dryGate !== -1 && sendAt !== -1 && dryGate < sendAt,
    );
    check(
      'last_sent_at is stamped only inside `if (result.sent)`, after the send',
      sendAt < sentGuard && sentGuard < stampAt && stampAt !== -1,
    );
    check(
      '--apply refuses to start without the provider keys and the token secret',
      /apply && \(!process\.env\.RESEND_API_KEY \|\| !process\.env\.EMAIL_FROM \|\| !secret\)/.test(script),
    );
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    check(
      'npm run alerts:send runs with DATA_SOURCE=db and no --apply',
      /DATA_SOURCE=db/.test(pkg.scripts['alerts:send'] ?? '') && !/--apply/.test(pkg.scripts['alerts:send'] ?? ''),
    );
  }

  // -------------------------------------------------------------------------
  // 7. The rules, evaluated.
  // -------------------------------------------------------------------------
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date('2026-09-27T12:00:00Z');
  check('an unconfirmed alert is never due', alertSkipReason({ confirmedAt: null, lastSentAt: null }, now) === 'unconfirmed');
  check(
    'an alert sent 3 days ago is not due',
    alertSkipReason({ confirmedAt: now, lastSentAt: new Date(now.getTime() - 3 * DAY) }, now) === 'recently_sent',
  );
  check(
    'an alert sent 6 days + 1 minute ago is due',
    alertSkipReason({ confirmedAt: now, lastSentAt: new Date(now.getTime() - 6 * DAY - 60_000) }, now) === null,
  );
  check(
    'zero new listings is a skip, not an empty email',
    alertSkipReason({ confirmedAt: now, lastSentAt: null }, now, 0) === 'no_new_jobs',
  );
  check(
    'a first window reaches back 7 days; later ones start at the last send',
    alertWindowStart(null, now).getTime() === now.getTime() - 7 * DAY &&
      alertWindowStart(new Date(now.getTime() - 9 * DAY), now).getTime() === now.getTime() - 9 * DAY,
  );

  // Fixture listings. Sentinel values ride on fields the email must NOT carry.
  const SENTINELS = {
    whatsapp: '595981000999',
    description: 'DESCRIPCION-PRIVADA-SENTINELA',
    companyWebsite: 'https://sentinela.example',
  };
  function job(n: number, over: Partial<Job>): Job {
    return {
      slug: `aviso-${n}`,
      title: `Puesto ${n}`,
      company: `Empresa ${n}`,
      companySlug: `empresa-${n}`,
      companyLogo: null,
      categorySlug: 'ventas',
      citySlug: 'asuncion',
      contractType: 'tiempo_completo',
      seniority: 'junior',
      modality: 'presencial',
      salaryMin: 3_000_000,
      salaryMax: 4_000_000,
      salaryHidden: false,
      featuredUntil: null,
      expiresAt: null,
      postedAt: new Date(now.getTime() - n * 60 * 60 * 1000).toISOString(),
      updatedAt: now.toISOString(),
      images: [],
      ...SENTINELS,
      ...over,
    };
  }
  const since = new Date(now.getTime() - 7 * DAY);
  const pool: Job[] = [
    ...Array.from({ length: 12 }, (_, i) => job(i + 1, {})),
    job(50, { categorySlug: 'administracion' }), // other category
    job(51, { citySlug: 'luque' }), // other city
    job(52, { postedAt: new Date(since.getTime() - 1000).toISOString() }), // before the window
    job(53, { postedAt: new Date(now.getTime() + DAY).toISOString() }), // after the run's clock
  ];
  const fresh = selectNewJobs(pool, { categorySlug: 'ventas', citySlug: 'asuncion' }, since, now);
  check(
    'matching keeps the filter and the window, newest first',
    fresh.length === 12 &&
      fresh.every((j) => j.categorySlug === 'ventas' && j.citySlug === 'asuncion') &&
      fresh[0].slug === 'aviso-1' &&
      !fresh.some((j) => ['aviso-50', 'aviso-51', 'aviso-52', 'aviso-53'].includes(j.slug)),
    fresh.map((j) => j.slug).join(','),
  );
  check(
    'a null filter half matches everything on that axis',
    selectNewJobs(pool, { categorySlug: null, citySlug: 'asuncion' }, since, now).some((j) => j.slug === 'aviso-50'),
  );
  check(
    'paging stops only past the featured block and the window',
    canStopPaging([job(1, {}), job(300, { postedAt: new Date(since.getTime() - DAY).toISOString() })], since, now) &&
      !canStopPaging(
        [job(300, { postedAt: new Date(since.getTime() - DAY).toISOString(), featuredUntil: new Date(now.getTime() + DAY).toISOString() })],
        since,
        now,
      ) &&
      !canStopPaging([job(1, {})], since, now),
  );

  // -------------------------------------------------------------------------
  // 8. The emails, rendered from fixtures.
  // -------------------------------------------------------------------------
  const alert = { categorySlug: 'ventas', citySlug: 'asuncion' };
  const hidden = { ...fresh[1], salaryHidden: true };
  const listed = [fresh[0], hidden, ...fresh.slice(2)];
  const digest = jobAlertDigestMessage('persona@ejemplo.com', alert, listed, rawToken);
  const again = jobAlertDigestMessage('persona@ejemplo.com', alert, listed, rawToken);
  const confirm = jobAlertConfirmationMessage('persona@ejemplo.com', alert, rawToken);
  if (process.argv.includes('--print')) {
    console.log(`\nSubject: ${confirm.subject}\n${JSON.stringify(confirm.headers)}\n\n${confirm.text}\n`);
    console.log(`Subject: ${digest.subject}\n${JSON.stringify(digest.headers)}\n\n${digest.text}\n`);
  }
  const text = digest.text;
  const numbered = text.split('\n').filter((l) => /^\d+\. /.test(l));
  check('the builder is deterministic', JSON.stringify(digest) === JSON.stringify(again));
  check(`at most ${JOB_ALERT_MAX_JOBS} listings, the rest linked`, numbered.length === JOB_ALERT_MAX_JOBS && /Y 2 más/.test(text));
  check(
    'the subject counts every new listing and names the filter',
    digest.subject === `12 empleos nuevos de ${categoryLabel('ventas')} en Asunción — trabajo.com.py`,
    digest.subject,
  );
  check(
    'each listing shows title, company, city, salary and an absolute link',
    text.includes('1. Puesto 1 — Empresa 1') &&
      text.includes('Asunción · Gs. 3.000.000 – 4.000.000') &&
      text.includes('https://trabajo.com.py/empleos/aviso-1'),
  );
  check('a hidden salary reads "A convenir"', text.includes('Asunción · A convenir'));
  check(
    'nothing beyond the public listing fields reaches the email',
    !Object.values(SENTINELS).some((v) => text.includes(v) || digest.subject.includes(v)),
  );
  check(
    'every email carries a working unsubscribe link and the one-click headers',
    [digest, confirm].every(
      (m) =>
        m.text.includes(`https://trabajo.com.py/alertas/baja?token=${rawToken}`) &&
        m.headers?.['List-Unsubscribe'] === `<https://trabajo.com.py/api/alertas/baja?token=${rawToken}>` &&
        m.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click',
    ),
  );
  check(
    'the confirmation links the confirm page, which POSTs',
    confirm.text.includes(`https://trabajo.com.py/alertas/confirmar?token=${rawToken}`),
  );
  check('the "ver todos" link is the indexable landing', text.includes('https://trabajo.com.py/trabajo/ventas/asuncion'));
  let threw = false;
  try {
    jobAlertDigestMessage('persona@ejemplo.com', alert, [], rawToken);
  } catch {
    threw = true;
  }
  check('the builder refuses an empty list', threw);
  {
    const src = read('lib/emails/job-alerts.ts');
    const start = src.indexOf('export type AlertJob = Pick<');
    const block = src.slice(start, src.indexOf('>;', start));
    const fields = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    const ALLOWED = ['citySlug', 'company', 'salaryHidden', 'salaryMax', 'salaryMin', 'slug', 'title'];
    check(
      'AlertJob declares exactly the public fields the email may show',
      JSON.stringify(fields) === JSON.stringify(ALLOWED),
      `found: ${fields.join(', ')}`,
    );
    const builder = code(src);
    check(
      'the email builder reads no clock, database or env beyond the site URL',
      !/new Date\(|Date\.now\(|lib\/db|process\.env/.test(builder),
    );
  }

  // The lead_submit / RFC 8058 wiring from the email seam's side.
  check(
    'lib/email.ts passes custom headers to Resend',
    /headers: message\.headers/.test(code(read('lib/email.ts'))),
  );

  console.log('');
  console.log(`(${relative(ROOT, join(ROOT, 'scripts/verify-alerts.ts'))}: no database, no network, no email provider)`);
  if (failures > 0) {
    console.error(`${failures} assertion(s) FAILED.`);
    process.exit(1);
  }
  console.log('All job-alert assertions passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
