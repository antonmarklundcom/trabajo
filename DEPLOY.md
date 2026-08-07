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

Four npm scripts own every database operation. Run them in this order against a
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

`db:seed` enforces its own gate: it exits non-zero if the row counts do not
match the seed files, so a broken upsert key shows up as a failure rather than
as silently duplicated jobs.

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
