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

### Process model: exactly one instance (owner-decided, 2026-08-19)

This app assumes it runs as **one persistent Node process**, and Hostinger
runs it that way. Two things depend on the assumption and break *silently*
if it stops holding: the in-memory rate limiters (`lib/rate-limit.ts`) become
per-instance — each instance half as strict — and `revalidateTag`-based cache
invalidation becomes per-instance, so an editor's publish is only seen by the
instance that handled the write while another keeps serving the stale page.

**Do not scale this app horizontally without first moving the rate limiters
to a shared store and giving cache invalidation a cross-instance signal.**
That is real, planned work (see `PLAN-PHASE3-DRAFT.md` §14 D3) — not a
config change.

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

The npm scripts below own every routine database operation (`db:purge` is
documented separately below). Run them in this order against a
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

The self-contained verify scripts run in CI on every push — see
`.github/workflows/ci.yml` for the current list rather than trusting a count
here (it has drifted before).

`db:seed` enforces its own gate: it exits non-zero if the row counts do not
match the seed files, so a broken upsert key shows up as a failure rather than
as silently duplicated jobs.

### Account scripts

Two scripts create or repair accounts. Both prompt for the password rather than
taking it as an argument — argv lands in shell history and in the process list —
and both print the host and database before writing.

```bash
npm run user:create   -- --email a@b.py --name "Ana" --role admin
npm run user:password -- --email a@b.py              # change a staff password
npm run user:password -- --email a@b.py --activate   # ...and re-enable the account
npm run candidate:create -- --email a@b.py --name "Ana" --phone 0981234567
```

`user:password` is the staff password-reset flow: an admin runs it out of band
(`ARCHITECTURE.md` §5). There is deliberately no self-serve reset for staff or
employer accounts — E1 built one for **candidates only**, because those accounts
are created by the person themselves, while staff and employer accounts are
provisioned by the team. `--activate` also clears the disabled flag set from
`/admin/usuarios`, which is the one way back for an account locked out by
mistake.

`candidate:create` is **local development and testing only** — it refuses to run
against a non-local database. It writes a `consents` row alongside the candidate
with `policy_version = "script"`, not because a command-line flag is consent but
because a candidate with no consent row is an impossible state in production,
and test data modelling an impossible state hides bugs in every query that
assumes the pair exists. The marker makes such rows greppable.

### `npm run blog:import` — the one-time Väg A → Väg B cutover

Articles used to be Markdown files in `content/blog/`; since 2026-08-12 they are
rows in `blog_posts`, written from `/admin/blog`
(`PLAN-PHASE3-DRAFT.md` §11). The files are no longer read, so between deploying
that change and running the import, **`/blog` is empty**. The two steps belong
in one sitting:

```bash
npm run db:migrate                 # creates blog_posts + blog_post_redirects
npm run blog:import                # dry run — prints what it would insert
npm run blog:import -- --write     # inserts
```

Idempotent by slug: an article already in the table is skipped, never updated —
re-running it after someone has edited a post in `/admin` cannot revert that
edit. Slugs are preserved exactly, so no URL changes and nothing needs
reindexing.

### `npm run db:purge` — the retention sweep

Hostinger gives us no cron, so data retention (`PLAN-PHASE2.md` §4.3) is a
script someone runs monthly, or a scheduled Claude Routine runs for them.

```bash
npm run db:purge              # DRY RUN — prints exactly what it would touch
npm run db:purge -- --apply   # executes it
npm run db:purge -- --verbose # list every affected id, not the first 25
```

A successful `--apply` run stamps `ops_state.last_purge_run`, and `/admin`
shows it as "Última depuración". It turns red past 35 days, or if the sweep has
never run — so a missed month is visible on the panel instead of only in
someone's memory. A run that reports failed deletions is deliberately NOT
stamped: it did not complete, and the card staying red is the correct answer.


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
numbers are quoted in `/privacidad` — see `PLAN-PHASE2.md` §8 Q1, resolved in
practice: the numbers are shipped and CI-locked, and changing them now is a
migration + re-consent, not a doc edit.

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

## Backups and restore

Hostinger's own backups are a courtesy, not a guarantee we control: the
retention and the restore granularity are set by the plan, not by us, and the
one thing they will not do is prove they work. This is the procedure that is
ours.

**Three stores, not one.** MySQL holds the rows; the CVs and the public images
are files somewhere else entirely (see the two sections below). A "backup" that
is only the database restores a site whose every logo is a broken image and
whose every CV download 404s.

### The dump

`mysqldump` over Remote MySQL from your own machine — the same connection the
`db:*` scripts use, with the same traps (§"Run migrations and scripts from your
local machine": your IP must be in the Remote MySQL allowlist, and if the
hostname gives `ECONNREFUSED` with credentials you have verified in phpMyAdmin,
use the raw IP).

```powershell
$stamp = Get-Date -Format "yyyy-MM-dd"
mysqldump `
  --host srv####.hstgr.io --port 3306 `
  --user <db_user> --password `
  --single-transaction --quick `
  --default-character-set=utf8mb4 `
  --routines --triggers `
  <db_name> > "trabajo-$stamp.sql"
```

- `--single-transaction` takes the dump inside one consistent snapshot without
  locking the tables, so the live site keeps serving while it runs.
- `--quick` streams row by row instead of buffering a table in RAM.
- `--default-character-set=utf8mb4` — leave it out and the Spanish accents and
  the ñ in company names come back mangled, which is the kind of corruption
  that restores successfully and is discovered months later.
- `--password` with **no value** prompts. A password on the command line lands
  in PowerShell history.

Check the file before trusting it. A dump that failed halfway is still a file:

```powershell
Select-String -Path "trabajo-$stamp.sql" -Pattern "Dump completed" | Select-Object -Last 1
```

No trailing `-- Dump completed` line means the dump is truncated. Do not keep
it and do not delete the previous one.

### Where dumps live, and the part that is easy to get wrong

**A dump is a file full of candidate personal data.** Names, phone numbers,
email addresses, work history, and the `consents` rows that authorise the
lot — everything `/privacidad` promises to protect, in plain text, on a laptop.
Treat it as the CV directory's equal, not as an ops artefact:

- Keep dumps in an encrypted location (an encrypted volume, or a
  password-protected archive), never in a synced folder that fans them out to
  every device, and never in a repo.
- **Keep the last three monthly dumps and delete the rest.** Retention applies
  to backups too: a dump from two years ago contains candidates the retention
  sweep has since deleted, which quietly undoes the deletion the policy
  promised. Three months is enough to recover from a corruption discovered late
  and short enough that a purged candidate leaves the backup set within one
  retention cycle.
- The `candidate_cvs` rows in the dump are metadata; the CV *bytes* are backed
  up separately, below.

### Cadence

Monthly, **in the same sitting as `npm run db:purge -- --apply`** — dump first,
then purge. Two reasons to pair them: the purge is the one routine operation
that deliberately destroys data, so a fresh dump is exactly what you want
behind it; and `/admin` already nags when the purge is more than 35 days old
(§O2), which makes the purge card double as the backup reminder. There is no
cron on Hostinger, so a monthly chore that has no reminder is a monthly chore
that does not happen.

### The restore rehearsal — run this once, now

An untested backup is a belief, not a backup. This proves the dump restores,
against a **scratch database**, without touching production. Run it once after
this lands, and again whenever the schema changes shape enough to worry you.

1. In hPanel → Databases, create a second database, e.g. `<db_name>_restore`,
   with its own user. **Not** the production database, and check the name twice
   before every command below.

2. Load the dump into it:

   ```powershell
   Get-Content "trabajo-$stamp.sql" | mysql `
     --host srv####.hstgr.io --port 3306 `
     --user <restore_db_user> --password `
     <db_name>_restore
   ```

3. Point the repo's own read-only checks at the scratch database. Nothing here
   writes, and `db:verify` prints the host it is about to touch before it does
   anything:

   ```powershell
   $env:DATABASE_URL = "mysql://<restore_db_user>:<pass>@srv####.hstgr.io:3306/<db_name>_restore"
   npm run db:verify     # row counts per table + jobs-by-status
   ```

   Compare the counts against `npm run db:verify` on production. Equal counts
   on `jobs`, `companies`, `candidates`, `applications` and `consents` is the
   pass condition. A restore that comes back with fewer `consents` rows than
   `applications` is a broken dump, not a rounding difference.

4. Spot-check one accented company name and one candidate row in phpMyAdmin.
   This is the check that catches the charset mistake, and it is the only one
   that does — row counts look perfect when every ñ has become a `?`.

5. **Delete the scratch database**, and clear `$env:DATABASE_URL` from that
   PowerShell window (§"Windows specifics": it stays set for the rest of the
   session, and the next `db:purge -- --apply` you run in that window would go
   to whatever it still points at). A scratch copy of candidate data left lying
   in hPanel is the same disclosure risk as an unencrypted dump, minus the
   excuse.

### Files: CVs and public images

Neither lives in MySQL, and the two drivers have different stories.

**`CV_STORAGE_DRIVER=r2` / `IMAGE_STORAGE_DRIVER=r2`.** Cloudflare R2 keeps
object versions and replicates across its own storage; a bucket is not a
directory on one disk. What you still owe it is the **credentials**, kept
somewhere you can reach when hPanel is what has failed, and a note of which
bucket belongs to which driver — the CV bucket is private and the image bucket
is public-read, and restoring a dump into the wrong pair makes every CV in the
site publicly readable.

**`CV_STORAGE_DRIVER=disk` / `IMAGE_STORAGE_DRIVER=disk`.** These are ordinary
directories on the Hostinger box (`/home/<user>/cv-storage`,
`/home/<user>/image-storage`) and **nothing backs them up on our schedule**.
Pull them down in the same sitting as the dump, over SSH or SFTP:

```bash
# from your machine, alongside the dump
scp -r <user>@<host>:/home/<user>/cv-storage  ./cv-storage-$stamp
scp -r <user>@<host>:/home/<user>/image-storage ./image-storage-$stamp
```

The CV copy is subject to every rule the dump is — encrypted at rest, three
months, never synced — and more strongly: it is the actual document a candidate
uploaded. The image copy is public content and needs no such care, but keep the
`img/{logos|blog|jobs}/…` paths intact, because those are the database's
`logo_key` / `image_key` values and a restore that flattens the directories
restores nothing.

Losing `image-storage` is recoverable — an employer can re-upload a logo.
Losing `cv-storage` is not, and it is a data-integrity failure under Ley N°
7593/2025 as well as a product one.

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
with a manual backup step you have to actually schedule (§"Backups and
restore"); losing a candidate's CV is both a product failure and a
data-integrity problem under Ley N° 7593/2025.

Rotating the R2 token is safe at any time: nothing signed with the old one
lives longer than 60 seconds. Changing the *bucket* or the *driver* is not —
existing `candidate_cvs.storage_key` values point into whatever store was live
when they were written, and the app has no migration path between drivers.


## Public image storage

Company logos, blog images and job-posting images go through
`lib/image-storage.ts` (`PLAN-IMAGES.md`). `IMAGE_STORAGE_DRIVER` picks the
backend and has no default, so a deploy that forgets it fails on the first
upload rather than writing somewhere wrong.

**Driver `disk` (the choice — `PLAN-IMAGES.md` §2).** `IMAGE_STORAGE_DIR` must
be an absolute path **outside the build root**, exactly like `CV_STORAGE_DIR`
and for exactly the same reason: `public_html/.builds/last-source/` is replaced
on every deploy, so a directory inside the app — including `public/` — is
deleted by the next merge to `main`, with every uploaded image in it. Something
like `/home/<user>/image-storage` survives. This is also why images are served
by a route handler (`/img/...`) instead of as static files: there is no static
directory that lives through a deploy.

Losing this directory is less serious than losing `CV_STORAGE_DIR` — an
employer can re-upload a logo — but it is still every image on the site, so it
belongs in the same backup routine `CV_STORAGE_DIR` gets (§"Backups and
restore").

**Driver `r2`.** A **public-read** bucket, which is the opposite of the CV
bucket's ACL and therefore a separate bucket, plus a custom domain on
Cloudflare DNS in `IMAGE_R2_PUBLIC_BASE_URL` (the `r2.dev` development domain
is rate-limited and not a production answer). Uploads and deletes are still
SigV4-signed with a token scoped to that one bucket; reads are anonymous.

Switching from `disk` to `r2` is an env var plus copying the directory into the
bucket with the `img/...` paths preserved as object keys — the database stores
the key, not the URL, so no rows change. Changing the directory or bucket
*under live data* is not safe: existing keys point into whatever store was live
when they were written.

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
