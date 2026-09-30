// Asserts the weekly employer summary's non-negotiables:
//
//   npm run digest:verify            (add `-- --print` to see the fixture email)
//
// Why a script. Every way this feature can go wrong is invisible from the
// dashboard and most of them are invisible in the inbox too:
//
//   - An applicant's name or phone in the email looks like a helpful feature
//     to whoever adds it, and is a candidate's data leaving the only channel
//     authorized to carry it (lib/emails/employer.ts, the rule at the top).
//   - A Destacado pitch on a listing that already IS featured reads as the
//     site not knowing what the customer bought.
//   - A second hand-built wa.me link is the config drift lib/whatsapp.ts
//     exists to prevent (AGENTS.md).
//   - A script that sends without --apply, or twice in a week, mails every
//     employer on the site and cannot be taken back.
//
// Evaluates the pure pieces directly — the email builder, the skip rules, the
// argument parser — and reads the wiring from source. No database, no network;
// runs under `--conditions=react-server` so lib/emails/employer.ts's
// `server-only` import resolves to its no-op build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DIGEST_MIN_INTERVAL_DAYS,
  digestCompanySkipReason,
  digestPeriodStart,
  digestSkipReason,
  parseDigestArgs,
  type DigestListing,
  type EmployerDigest,
} from '../lib/employer-digest';
import { employerWeeklyDigestMessage } from '../lib/emails/employer';
import { employerWhatsAppHref } from '../lib/whatsapp';

const ROOT = process.cwd();
const DAY = 24 * 60 * 60 * 1000;

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

/** Source with comments removed; keeps `https://` inside strings (see verify-whatsapp.ts). */
function code(source: string): string {
  return source.replace(/(?<!:)\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The body of `function <name>(`, up to the line that is only its closing
 * brace. Not the first `\n}`: a multi-line return type (`Promise<{ … } | null>`)
 * has a column-0 brace of its own, and stopping there would inspect the
 * signature and call it the body.
 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const rest = source.slice(start);
  const end = rest.search(/\n\}[ \t]*(\n|$)/);
  return end === -1 ? rest : rest.slice(0, end);
}

// The env the builder reads, pinned so the output is deterministic.
process.env.NEXT_PUBLIC_SITE_URL = 'https://trabajo.com.py';
process.env.NEXT_PUBLIC_WHATSAPP_LEADS = '595971000000';

// ---------------------------------------------------------------------------
// Fixture: one company, four public listings covering every branch.
// ---------------------------------------------------------------------------

const now = new Date('2026-09-28T11:00:00Z');

// Applicant data that a careless builder could reach: attached to the fixture
// objects as extra properties the type does not declare. None of it may appear
// in the output. A builder that spread, stringified or iterated a listing
// would leak it; one that reads only DigestListing's fields cannot.
const SENTINELS = {
  applicantName: 'Sentinela Postulante Gómez',
  applicantPhone: '0981999111',
  applicantEmail: 'sentinela@example.com',
  applicantMessage: 'Mensaje privado del postulante',
};

function listing(overrides: Partial<DigestListing> & Pick<DigestListing, 'jobId' | 'title'>): DigestListing {
  return {
    slug: `aviso-${overrides.jobId}`,
    viewCount: 0,
    viewsSinceDigest: 0,
    applicationsInPeriod: 0,
    expiresAt: new Date(now.getTime() + 20 * DAY),
    featuredUntil: null,
    ...SENTINELS,
    ...overrides,
  } as DigestListing;
}

const listings: DigestListing[] = [
  // Not featured, applications this week, expiring in 3 days.
  listing({
    jobId: 101,
    title: 'Vendedor/a de mostrador',
    viewCount: 240,
    viewsSinceDigest: 57,
    applicationsInPeriod: 3,
    expiresAt: new Date(now.getTime() + 3 * DAY),
  }),
  // Featured (window open), some views, no applications.
  listing({
    jobId: 102,
    title: 'Cajero/a',
    viewCount: 510,
    viewsSinceDigest: 88,
    featuredUntil: new Date(now.getTime() + 30 * DAY),
  }),
  // Zero views and zero applications, not featured.
  listing({ jobId: 103, title: 'Auxiliar contable', viewCount: 12, viewsSinceDigest: 0 }),
  // Featured window already closed: counts as NOT featured.
  listing({
    jobId: 104,
    title: 'Chofer repartidor',
    viewCount: 40,
    viewsSinceDigest: 9,
    applicationsInPeriod: 1,
    featuredUntil: new Date(now.getTime() - 2 * DAY),
  }),
];

const digest: EmployerDigest = {
  companyName: 'Comercial Ejemplo S.A.',
  previousDigestAt: new Date(now.getTime() - 7 * DAY),
  now,
  listings,
};

const message = employerWeeklyDigestMessage('rrhh@example.com', 'Ana', digest);
const text = message.text;

if (process.argv.includes('--print')) {
  console.log(`Subject: ${message.subject}\n\n${text}\n`);
}

/** The lines of one listing's block in the rendered text. */
function block(rendered: string, index: number): string {
  const start = rendered.indexOf(`\n${index + 1}. `);
  const next = rendered.indexOf(`\n${index + 2}. `, start + 1);
  const end = next === -1 ? rendered.indexOf('\nTodos tus avisos', start) : next;
  return start === -1 ? '' : rendered.slice(start, end);
}

// ---------------------------------------------------------------------------
// 1. No applicant personal data — by type, by query, and in the output.
// ---------------------------------------------------------------------------

const digestSource = read('lib/employer-digest.ts');
const typeStart = digestSource.indexOf('export type DigestListing = {');
const typeBlock = code(digestSource.slice(typeStart, digestSource.indexOf('\n};', typeStart)));
const fields = [...typeBlock.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
const ALLOWED_FIELDS = [
  'jobId',
  'title',
  'slug',
  'viewCount',
  'viewsSinceDigest',
  'applicationsInPeriod',
  'expiresAt',
  'featuredUntil',
];

check(
  'DigestListing declares exactly the allowed fields',
  typeStart !== -1 &&
    fields.length === ALLOWED_FIELDS.length &&
    ALLOWED_FIELDS.every((f) => fields.includes(f)),
  `Found: ${fields.join(', ') || '(type not found)'}. A new field here is a new thing the ` +
    'email could carry; add it to ALLOWED_FIELDS only after deciding it is not personal data.',
);

check(
  'no DigestListing field can hold an applicant name, phone, email, message or CV',
  !fields.some((f) => /name|phone|mail|message|cv|candidate|applicant/i.test(f)),
  `Offending: ${fields.filter((f) => /name|phone|mail|message|cv|candidate|applicant/i.test(f)).join(', ')}`,
);

const employerSource = read('lib/db/employer.ts');
const digestQuery = code(functionBody(employerSource, 'getEmployerDigest'));

check(
  'getEmployerDigest() exists and is inspectable',
  digestQuery.length > 0,
  'Could not find getEmployerDigest() in lib/db/employer.ts. If it moved, move this check with it.',
);

check(
  'getEmployerDigest() counts applications and selects none of their personal columns',
  digestQuery.includes('count(applications.id)') &&
    !/applications\.(name|phone|email|message|cvId|candidateId|consentId)\b/.test(digestQuery) &&
    !/\bcandidates\b|\bcandidateCvs\b/.test(digestQuery),
  'The summary may say HOW MANY applied, never who. Read the candidate tables here and the ' +
    'rows exist one refactor away from the template.',
);

check(
  'rendered email reports the application count',
  block(text, 0).includes('Postulaciones esta semana: 3') &&
    block(text, 3).includes('Postulaciones esta semana: 1'),
  'The count is the whole point of the summary; if it is gone the fixture no longer covers it.',
);

check(
  'rendered email contains none of the applicant data attached to the fixture',
  Object.values(SENTINELS).every((v) => !text.includes(v) && !message.subject.includes(v)),
  'The builder read something beyond DigestListing — a spread, a JSON.stringify, a loop over ' +
    'the object. Found: ' +
    Object.values(SENTINELS)
      .filter((v) => text.includes(v))
      .join(', '),
);

check(
  'applications link to the session-gated panel, not to anything with data in it',
  block(text, 0).includes('https://trabajo.com.py/empresa/postulaciones?job=101') &&
    !block(text, 1).includes('/empresa/postulaciones'),
  'A listing with applications links to /empresa/postulaciones; one without does not.',
);

// ---------------------------------------------------------------------------
// 2. Destacado is offered only where it is not already bought.
// ---------------------------------------------------------------------------

const PITCH = 'Destacá este aviso';

check(
  'Destacado line is present for a non-featured listing',
  block(text, 0).includes(PITCH) && block(text, 2).includes(PITCH),
);

check(
  'Destacado line is absent for a featured listing, which shows its window instead',
  !block(text, 1).includes(PITCH) && block(text, 1).includes('Destacado hasta el'),
  'Pitching Destacado to a customer who already bought it reads as the site not knowing.',
);

check(
  'a lapsed featured window counts as not featured',
  block(text, 3).includes(PITCH) && !block(text, 3).includes('Destacado hasta el'),
  'featured is `featured_until > NOW()` (AGENTS.md); a past date is not featured.',
);

check(
  'exactly one Destacado line per non-featured listing',
  text.split(PITCH).length - 1 === 3,
  `Found ${text.split(PITCH).length - 1}; expected 3 (listings 1, 3 and 4). "One understated line".`,
);

check(
  'no outcome promises anywhere in the email',
  !/garantiz|asegur|más postulantes|más candidatos|contrat|conseguí/i.test(text),
  'Numbers only. The site promises no outcomes (PLAN-GROWTH.md §7 D1).',
);

// ---------------------------------------------------------------------------
// 3. Every wa.me link comes from lib/whatsapp.ts.
// ---------------------------------------------------------------------------

const links = text.match(/https:\/\/wa\.me\/\S+/g) ?? [];
const expected = new Set(
  listings.flatMap((l) => {
    const context = { jobTitle: l.title, companyName: digest.companyName };
    return [
      employerWhatsAppHref('destacado', { context }),
      employerWhatsAppHref('renovar_aviso', { context }),
    ].filter((h): h is string => h !== null);
  }),
);

check(
  'the email carries wa.me links (the check below is not vacuous)',
  links.length >= 4,
  `Found ${links.length}; expected three Destacado links and one renewal.`,
);

check(
  'every wa.me link in the email is one employerWhatsAppHref() builds',
  links.every((l) => expected.has(l)),
  `Not from lib/whatsapp.ts: ${links.filter((l) => !expected.has(l)).join(', ')}`,
);

{
  // Listing 3's block has no renewal link, so the only wa.me link on its
  // Destacado line is the Destacado one — decoded, it must name the listing.
  const pitchLine = block(text, 2).split('\n').find((line) => line.includes(PITCH)) ?? '';
  const href = pitchLine.match(/https:\/\/wa\.me\/\S+/)?.[0] ?? '';
  const prefilled = decodeURIComponent(href.slice(href.indexOf('?text=') + '?text='.length));
  check(
    'the Destacado link names the listing and company it is about',
    prefilled.includes('Puesto: Auxiliar contable') &&
      prefilled.includes(`Empresa: ${digest.companyName}`),
    `Prefilled message: "${prefilled}". Without the job context the team cannot tell which ` +
      'aviso the chat is about.',
  );
}

const emailsSource = read('lib/emails/employer.ts');
check(
  'lib/emails/employer.ts builds no wa.me URL itself',
  !code(emailsSource).includes('wa.me') &&
    /import \{[^}]*\bemployerWhatsAppHref\b[^}]*\} from '\.\.\/whatsapp'/.test(emailsSource),
  'AGENTS.md: every wa.me link is built by lib/whatsapp.ts.',
);

check(
  'every wa.me link in the email goes to the fixed site number',
  links.every((l) => l.startsWith('https://wa.me/595992279599?')),
);

// ---------------------------------------------------------------------------
// 4. The rest of the copy contract.
// ---------------------------------------------------------------------------

check(
  'an aviso expiring within 7 days shows the date and a renewal action; a later one does not',
  block(text, 0).includes('Vence el') &&
    block(text, 0).includes('Renovar: https://wa.me/') &&
    !block(text, 1).includes('Vence el'),
);

check(
  'a listing with 0 views and 0 applications says so and links to its edit page',
  block(text, 2).includes('no tuvo visitas ni postulaciones') &&
    block(text, 2).includes('https://trabajo.com.py/empresa/empleos/103') &&
    !block(text, 0).includes('no tuvo visitas'),
);

check(
  'the footer says how to turn the summary off',
  text.includes('Podés desactivarlo') && text.includes('https://trabajo.com.py/empresa/perfil'),
);

check(
  'subject is the agreed one',
  message.subject === 'Tu resumen semanal en trabajo.com.py',
);

{
  const first = employerWeeklyDigestMessage('rrhh@example.com', 'Ana', {
    ...digest,
    previousDigestAt: null,
  }).text;
  check(
    'a first summary reports total views, not a "this week" delta it has no snapshot for',
    first.includes('Visitas: 240 en total') &&
      !first.includes('esta semana') &&
      first.includes('Postulaciones en los últimos 7 días: 3'),
  );
}

{
  const late = employerWeeklyDigestMessage('rrhh@example.com', 'Ana', {
    ...digest,
    previousDigestAt: new Date(now.getTime() - 21 * DAY),
  }).text;
  check(
    'after a missed week the period is named by date, not called "esta semana"',
    !late.includes('esta semana') && late.includes('Visitas desde el'),
  );
}

// ---------------------------------------------------------------------------
// 5. No send without --apply.
// ---------------------------------------------------------------------------

check(
  'no arguments means dry run',
  parseDigestArgs([]).apply === false && parseDigestArgs(['--verbose']).apply === false,
);
check('--apply is the only switch that sends', parseDigestArgs(['--apply']).apply === true);
check(
  'a misspelt --apply is rejected, not ignored into a dry run that looks like a send',
  parseDigestArgs(['--aply']).unknown.length === 1 && parseDigestArgs(['--aply']).apply === false,
);

const script = code(read('scripts/employer-digest.ts'));
const firstSend = script.indexOf('sendEmail(');

check(
  'the sender script calls sendEmail() exactly once',
  (script.match(/sendEmail\(/g) ?? []).length === 1,
  'A second call site is a second send path to prove dry-run-safe.',
);

check(
  '`apply` comes only from parseDigestArgs()',
  /const \{ apply[^}]*\} = parseDigestArgs\(/.test(script) &&
    (script.match(/\bapply\s*=/g) ?? []).length === 0,
  'An env var or a default that sets apply would make the harmless run not the default one.',
);

check(
  'the send is behind `if (!apply) continue;`',
  script.includes('if (!apply) continue;') && script.indexOf('if (!apply) continue;') < firstSend,
);

check(
  '--apply fails fast without RESEND_API_KEY / EMAIL_FROM, before touching the database',
  script.includes('apply && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)') &&
    script.indexOf('process.env.RESEND_API_KEY') < script.indexOf('requireDatabaseUrl()'),
  'sendEmail() degrades to log-and-skip on purpose; for a job whose only purpose is sending, ' +
    'that must be a refusal up front.',
);

// ---------------------------------------------------------------------------
// 6. Idempotency: never twice within DIGEST_MIN_INTERVAL_DAYS.
// ---------------------------------------------------------------------------

const on = { notifyWeeklyDigest: true };
const ago = (ms: number) => new Date(now.getTime() - ms);

check(
  `a company summarised less than ${DIGEST_MIN_INTERVAL_DAYS} days ago is skipped`,
  digestCompanySkipReason({ ...on, lastDigestSentAt: ago(1 * DAY) }, now) === 'recently_sent' &&
    digestCompanySkipReason({ ...on, lastDigestSentAt: ago(6 * DAY - 60_000) }, now) ===
      'recently_sent' &&
    digestCompanySkipReason({ ...on, lastDigestSentAt: now }, now) === 'recently_sent',
);

check(
  'a company summarised a week ago, or never, is due',
  digestCompanySkipReason({ ...on, lastDigestSentAt: ago(6 * DAY) }, now) === null &&
    digestCompanySkipReason({ ...on, lastDigestSentAt: ago(7 * DAY) }, now) === null &&
    digestCompanySkipReason({ ...on, lastDigestSentAt: null }, now) === null,
);

check(
  'an opted-out company is skipped even if it was never summarised',
  digestCompanySkipReason({ notifyWeeklyDigest: false, lastDigestSentAt: null }, now) === 'opted_out',
);

check(
  'no public listing, or nobody to send to, is a skip',
  digestSkipReason({ ...on, lastDigestSentAt: null }, now, { listings: 0, recipients: 2 }) ===
    'no_public_listings' &&
    digestSkipReason({ ...on, lastDigestSentAt: null }, now, { listings: 2, recipients: 0 }) ===
      'no_recipients' &&
    digestSkipReason({ ...on, lastDigestSentAt: null }, now, { listings: 1, recipients: 1 }) === null,
);

check(
  'the application period starts at the previous summary, or 7 days back on the first',
  digestPeriodStart(ago(9 * DAY), now).getTime() === ago(9 * DAY).getTime() &&
    digestPeriodStart(null, now).getTime() === ago(7 * DAY).getTime(),
);

check(
  'the script applies both skip rules before it sends',
  script.includes('const early = digestCompanySkipReason(company, now);') &&
    script.includes('const reason = digestSkipReason(') &&
    /if \(early\) \{\s*skip\(early\);\s*continue;/.test(script) &&
    /if \(reason\) \{\s*skip\(reason\);\s*continue;/.test(script) &&
    script.search(/if \(reason\) \{/) < firstSend,
  'Both decisions must be assigned from the pure functions and must `continue` past the send.',
);

{
  const afterSend = script.slice(firstSend);
  const recordAt = afterSend.indexOf('recordEmployerDigestSent(');
  const guardAt = afterSend.indexOf('if (delivered > 0)');
  check(
    'the send is recorded only after it succeeded',
    (script.match(/recordEmployerDigestSent\(/g) ?? []).length === 1 &&
      script.indexOf('recordEmployerDigestSent(') > firstSend &&
      guardAt !== -1 &&
      guardAt < recordAt &&
      afterSend.includes('if (result.sent) delivered += 1;'),
    'Recording before the send, or regardless of it, turns a provider outage into a skipped week.',
  );
}

{
  const record = code(functionBody(employerSource, 'recordEmployerDigestSent'));
  check(
    'recordEmployerDigestSent() stamps the company and snapshots views, scoped to the company',
    record.includes('lastDigestSentAt: sentAt') &&
      record.includes('viewCountAtDigest: listing.viewCount') &&
      record.includes('ownedByCompany(companyId)') &&
      record.includes('eq(companies.id, companyId)') &&
      record.includes('.transaction('),
  );
}

check(
  'listEmployerDigestRecipients() enforces the opt-out at the read',
  /notifyWeeklyDigest\) return \[\]/.test(code(functionBody(employerSource, 'listEmployerDigestRecipients'))),
  'The toggle on /empresa/perfil must hold even for a caller that forgets to check it.',
);

// ---------------------------------------------------------------------------
// 7. "Public listing" means what the public site means by it.
// ---------------------------------------------------------------------------

{
  const normalize = (s: string) =>
    code(s)
      .replace(/\s+/g, '')
      .replace(/,\)/g, ')');
  const visible = normalize(functionBody(read('lib/db/queries.ts'), 'visiblePredicate'));
  const live = normalize(functionBody(employerSource, 'liveListing'));
  const conditions = (body: string) => body.slice(body.indexOf('returnand(') + 'returnand('.length);
  check(
    'liveListing() in lib/db/employer.ts is the same two conditions as visiblePredicate()',
    live.length > 0 && visible.length > 0 && conditions(live) === conditions(visible),
    'The summary reports on the listings the public can see. If visiblePredicate() changed, ' +
      'change liveListing() to match.',
  );
}

console.log(failures === 0 ? '\nAll digest checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
