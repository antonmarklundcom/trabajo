# DEPLOY.md — trabajo.com.py on Hostinger

> App deploy + MySQL operations. Distilled from deployments that already cost
> real debugging time (propia, FacturaPY, embarazo.com.py) — trust these before
> re-diagnosing from scratch.

## App deploy

Managed GitHub integration — no SSH, PM2 or Nginx.

1. Work merges to `main`; Hostinger auto-redeploys (~3–5 min).
2. hPanel → Websites → Node.js Apps → Import Git Repository.
   Branch `main`, Node 22.x, build `npm run build`, start `npm start`.
3. Set every env var in hPanel (never commit secrets).
4. Attach `trabajo.com.py` + `www.trabajo.com.py`; SSL is automatic.

**Env var changes require a redeploy, not a restart.**

### Environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs, canonicals, sitemap |
| `NEXT_PUBLIC_WHATSAPP_LEADS` | WhatsApp destination for leads |
| `NEXT_PUBLIC_BUSINESS_NAME` | Branding strings |
| `DATA_SOURCE` | `seed` \| `db` — the source switch |
| `DATABASE_URL` | `mysql://user:pass@localhost:3306/dbname` on the live app |
| `SESSION_SECRET` | iron-session key, ≥32 random chars |
| `NEXT_PUBLIC_GA_ID` | Optional — no analytics script loads without it |
| `GHL_WEBHOOK_URL` | Optional lead sink |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Optional lead sink |
| `VENDERCRM_API_KEY` | Optional — only if VenderCRM is switched on |

The live app connects to MySQL over `localhost`. The remote host below is for
your machine only.

## MySQL operations

### Run migrations and scripts from your local machine, not Hostinger SSH

1. hPanel → Databases → **Remote MySQL** → add your current public IP.
   PowerShell: `(Invoke-WebRequest -uri "https://api.ipify.org" -UseBasicParsing).Content`
   Home ISPs rotate IPs after a router restart — `Access denied for user
   '...'@'<new-ip>'` means your IP changed, not that the password is wrong.
2. The remote host/port is shown on that same page (e.g. `srv####.hstgr.io`,
   port 3306) and is **different** from the `localhost` the live app uses.
3. If the hostname gives `ECONNREFUSED` with confirmed-correct credentials
   (verify via phpMyAdmin, which bypasses remote-host checks), use the raw IP
   instead — DNS/IPv6 flakiness on Hostinger is a recurring theme.

## The `db:*` scripts

These four npm scripts own every routine database operation (the fifth,
`db:purge`, is documented below). Run them in this order against a
fresh database; each one prints the host/database it is about to touch, so you
can catch "oops, that was production" before it writes.

```bash
npm run db:migrate   # applies drizzle/*.sql
npm run db:seed      # imports lib/seed/*.json — idempotent, safe to re-run
npm run db:verify    # read-only row counts per table + jobs-by-status
npm run db:parity    # diffs the seed and db read paths, exits 1 on any mismatch
```

`npm run db:generate` (drizzle-kit) writes a new migration after a schema
change; it does not connect to a database.

`npm run db:verify-scoping` is a **local-only** check, not an operation: it
writes two throwaway companies with a job and an applicant each, asserts that
neither can see or modify the other through `lib/db/employer.ts`, and deletes
them again. It refuses a non-local `DATABASE_URL` without `--force` — do not
point it at production. Run it after touching anything in that module. It runs
under `tsx --conditions=react-server` so that `server-only` resolves to its
no-op build, the same way it does inside a React Server Component.

`npm run storage:verify` is also local-only and needs neither a database nor a
bucket: it round-trips the disk driver through a temp directory, asserts the
magic-byte and 5 MB rules in `lib/cv.ts`, asserts every driver method refuses a
key that is not `cv/{candidateId}/{uuid}.{ext}`, and checks the hand-rolled
SigV4 presigner against the signature AWS publishes for its documented example
request. Run it after touching `lib/storage.ts` or `lib/cv.ts`.

`npm run retention:verify` needs nothing at all — no database, no env — and
asserts the month arithmetic behind `db:purge` (see below).

`npm run access:verify` also needs nothing: it reads
`lib/db/candidates-admin.ts` and asserts the `PLAN-PHASE2.md` §2.4
construction — every export checks for `admin`, every function that returns
candidate data validates its reason and writes `data_access_logs` **before**
returning, and neither a `LIKE` search nor a bulk export has appeared in the
file. A new export there fails this check until it is classified in the script,
which is the point: adding one should be a decision, not a diff.

All three run in CI on every push.

`db:seed` enforces its own gate: it exits non-zero if the row counts do not
match the seed files, so a broken upsert key shows up as a failure rather than
as silently duplicated jobs.

### `npm run db:purge` — the retention sweep

Hostinger gives us no cron, so data retention (`PLAN-PHASE2.md` §4.3) is a
script someone runs monthly, or a scheduled Claude Routine runs for them.

```bash
npm run db:purge              # DRY RUN — prints exactly what it would touch
npm run db:purge -- --apply   # executes it
npm run db:purge -- --verbose # list every affected id, not the first 25
```

**Dry run is the default and `--apply` is required to change anything.** Read
the dry run before you pass `--apply`: both runs use the same queries and the
same cutoffs, so the list you read is the list that gets acted on. It prints ids
and dates only — never names, emails or filenames — so the output is safe to
paste into an issue.

What it does, in this order:

| Section | Retention | Action |
|---|---|---|
| Candidate profiles + CVs | 24 months after last login | Full `PLAN-PHASE2.md` §4.4 deletion — CV objects first, then the rows |
| (warning window) | 23 months | **Reports only.** No email provider exists yet (§8 Q5) |
| Application personal data | 12 months after the job closed | Redaction: the row survives, the personal columns are NULLed |
| `consents` | 5 years after the data they authorised was purged | Deleted. Never for a candidate who still exists |
| `data_access_logs` | 24 months | Deleted |

`deletion_requests` is retained indefinitely and is never swept: it holds no
personal data and it is the evidence that the rest of the sweep was authorised.

Two operational notes:

- **`--apply` needs `CV_STORAGE_DRIVER` configured** whenever a candidate is due,
  because their CV objects are deleted from storage before any row that records
  where those objects are. The script checks the driver up front so it fails
  before the first candidate rather than between the third and the fourth.
- A candidate whose storage delete fails is **left completely in place** and the
  script exits non-zero, having recorded the failure in that candidate's
  `deletion_requests` row (`executed_at` stays NULL). Rerun once storage is
  reachable. A run that exits 0 deleted everything it listed.

The periods above live in `lib/retention.ts`, in one place, because the same
numbers are quoted in `/privacidad` — see open question §8 Q1, still unanswered.

### `drizzle-kit` connecting does NOT mean your scripts will

`drizzle-kit` auto-loads `.env`. Plain `tsx` scripts do **not**. An
`ECONNREFUSED` from a seed/import script right after a successful migration
almost always means `process.env.DATABASE_URL` is undefined and mysql2 silently
fell back to `localhost`.

The `db:*` scripts defuse this in two ways: they pass
`--env-file-if-exists=.env` to tsx, and they refuse to start at all when
`DATABASE_URL` is missing or malformed, printing the likely cause instead of a
mysql2 stack trace. `db:migrate` runs the drizzle-orm migrator under tsx rather
than shelling out to `drizzle-kit migrate`, precisely so that migrate, seed,
verify and parity all resolve `DATABASE_URL` the same way.

For a one-off run against a host that is not in `.env`, set it inline:

```powershell
$env:DATABASE_URL = "mysql://user:pass@srv####.hstgr.io:3306/dbname"
npm run db:verify
```

It stays set for the rest of that PowerShell window.

### Windows specifics

- `node --env-file=.env node_modules/.bin/tsx …` fails on Windows —
  `.bin/tsx` is a bash shim. Use `$env:VAR = "…"` + `npx tsx script.ts`.
- **Never create `.env` with `>` redirect** — PowerShell writes UTF-16 and
  dotenv parsers fail silently. Use
  `Set-Content -Path .env -Value 'DATABASE_URL=...' -Encoding utf8`.
- npm/npx blocked by execution policy → once:
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

### The trap that takes the site down silently

Changing the MySQL user's password to enable local access **breaks the live
app**, which still holds the old password in its hPanel `DATABASE_URL`. The
site crashes with a generic "Application error" / `Digest: …` page carrying no
useful information, and Runtime Logs show the failing query but not the MySQL
cause.

- Check hPanel → Environment Variables for the existing `DATABASE_URL`
  **before** changing any password.
- After changing it, update the live env var too, then **redeploy**.
- Pasting into hPanel: put only the raw value in the Value field. A
  `DATABASE_URL=mysql://…` string pasted whole produces `ERR_INVALID_URL` with
  the var name visible inside the error's `input`.

### Hostinger SSH, if unavoidable

`npm`/`npx` are not on the default PATH:
`export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH` (check what exists under
`/opt/alt/`). Deployed source lives at `public_html/.builds/last-source/`.

## CV storage

CVs are the most personal thing this application stores, and they do not live
in MySQL. `CV_STORAGE_DRIVER` picks where the bytes go; there is no default, so
a deploy that forgets it fails loudly on the first upload instead of quietly
choosing somewhere wrong.

**Driver `r2` (recommended).** A private Cloudflare R2 bucket. Create the
bucket with no public access and no custom public domain, then an R2 API token
scoped to Object Read & Write **on that one bucket** — an account-wide token is
a token a web process can use to read every other bucket you own. Set
`CV_R2_ACCOUNT_ID`, `CV_R2_BUCKET`, `CV_R2_ACCESS_KEY_ID` and
`CV_R2_SECRET_ACCESS_KEY` in hPanel. Downloads are 60-second presigned URLs
minted per request and never stored, so there is no CV URL anywhere that
outlives the click that produced it.

**Driver `disk` (fallback).** `CV_STORAGE_DIR` must be an absolute path
**outside the build root**. The deployed source lives under
`public_html/.builds/last-source/` and is replaced on every deploy, so a
directory inside the app is deleted by the next merge to `main` — with the CVs
in it. Something like `/home/<user>/cv-storage` survives. Nothing on the
Hostinger side backs that directory up on our schedule, so this driver comes
with a manual backup step you have to actually schedule; losing a candidate's
CV is both a product failure and a data-integrity problem under Ley N°
7593/2025.

Rotating the R2 token is safe at any time: nothing signed with the old one
lives longer than 60 seconds. Changing the *bucket* or the *driver* is not —
existing `candidate_cvs.storage_key` values point into whatever store was live
when they were written, and the app has no migration path between drivers.


## Slots

10 Node.js apps per Hostinger account. trabajo occupies one; the custom backend
adds a **database**, not a slot. Static/content sites belong on Cloudflare
Pages, and single-service funnels on GHL — don't spend a slot on either.

## Post-deploy checklist

- [ ] Loads on the Hostinger URL, then the custom domain with valid SSL
- [ ] Absolute-URL env vars match the final domain
- [ ] Admin login works with **rotated** credentials — never ship a seeded
      default password
- [ ] A write from the live app reaches the DB (create one test record)
- [ ] `robots.txt` and `sitemap.xml` reachable; `/admin` excluded from both
- [ ] Slot recorded: which account, how many remain
