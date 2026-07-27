# Neon Postgres Reconnect — `neon-reconnect` branch

This branch flips the Prisma provider from SQLite to PostgreSQL and points the
datasource at the **Neon** project `neon-almond-fountain`. The hybrid backend
strategy (Sheets for operational data + Neon for valuable/security-critical
data + Cloudflare R2 for images) is preserved — the Google Apps Script
webhook (`seed/AppsScript.gs`) and the `/api/sheet/*` routes are untouched.

## 1. What changed on this branch

| File / Dir                                                | Change                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                                    | `provider = "sqlite"` → `"postgresql"`; added `directUrl = env("DIRECT_URL")`. |
| `prisma/migrations/migration_lock.toml`                   | `provider = "sqlite"` → `"postgresql"`.                                        |
| `prisma/migrations/20260726120000_neon_postgres_init/`    | New migration. 6 tables, 25 indexes, 3 FKs (216-line DDL).                     |
| `prisma/migrations/20260705181230_init/`                  | Moved to `docs/sqlite-migrations-archive/` so Prisma CLI ignores them.         |
| `prisma/migrations/20260707130000_add_user_profile_and_seed_sync/` | Moved to `docs/sqlite-migrations-archive/`.                          |
| `.env.example`                                            | Documented `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) Neon patterns.      |
| `package.json`                                            | Added `db:deploy`, `db:status`, `db:resolve` scripts + `@neondatabase/serverless` dep. |
| `NEON_RECONNECT.md`                                       | This file.                                                                     |

`server.ts` and `api/sheet/` are **untouched** on this branch — splitting the
monolith into Vercel serverless routes is a follow-up task (Option 2).

## 2. Local setup

```bash
git checkout neon-reconnect
npm install
cp .env.example .env   # then fill in DATABASE_URL + DIRECT_URL from Neon dashboard
npx prisma validate    # should print "The schema at prisma/schema.prisma is valid"
```

The Neon dashboard (Connection Details) gives you two strings. They look like
this (placeholder values):

```
DATABASE_URL=postgresql://USER:PASS@ep-foo-pooler.region.aws.neon.tech/DB?sslmode=require&pgbouncer=true&channel_binding=require
DIRECT_URL=postgresql://USER:PASS@ep-foo.region.aws.neon.tech/DB?sslmode=require&channel_binding=require
```

- `DATABASE_URL` uses the **`-pooler`** hostname + `pgbouncer=true`. This is
  the runtime connection Prisma Client uses — every Vercel serverless
  invocation shares the pool.
- `DIRECT_URL` removes `-pooler` and the `pgbouncer` param. Prisma migrations
  need a dedicated session and cannot run through pgBouncer's transaction mode.

## 3. Database state on Neon

The migration `20260726120000_neon_postgres_init` has already been applied to
the `neon-almond-fountain` project. Verify any time:

```bash
# From a machine with TCP egress on port 5432:
npm run db:status
# Expected: "Database schema is up to date!"
```

If you're on a sandboxed machine that blocks port 5432 (e.g. CI without TCP
egress), use the HTTP driver instead:

```bash
node scripts/_neon_verify.mjs
```

This prints the table list, `_prisma_migrations` rows, and row counts per
Prisma table.

### Tables created

- `Submission` — one per field-visit / form submit (parent)
- `Seedling` — repeatable species rows per submission (1:N)
- `Photo` — geo-verified evidence trail (1:N)
- `Monitoring` — revisit measurements per submission (1:N)
- `UserProfile` — Admin / Cadre / Monitoring Officer / SAAO / Citizen
- `SeedSync` — tracks when workbook seed data was last pushed to DB
- `_prisma_migrations` — Prisma's own migration ledger

All tables are empty as of branch creation. The Google Apps Script seed
pipeline will populate them via the `/api/sheet/*` webhook (still pointing
at Sheets in this branch — Option 3 will add a Sheets→Neon sync).

## 4. Deploying to Vercel

### 4.1 Environment variables

In the Vercel project dashboard → Settings → Environment Variables, add
**both** for Production + Preview + Development:

| Key            | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL` | Pooled Neon URL with `?sslmode=require&pgbouncer=true&channel_binding=require` |
| `DIRECT_URL`   | Direct Neon URL with `?sslmode=require&channel_binding=require`           |
| `GEMINI_API_KEY` | (unchanged — copy from existing Vercel env)                             |
| `GAS_WEBHOOK_URL` | (unchanged — copy from existing Vercel env)                             |

### 4.2 Build command

`vercel.json` currently uses:

```json
{ "buildCommand": "prisma generate && vite build" }
```

This is sufficient for this branch — `prisma generate` produces the
PostgreSQL-flavored client, and Vite builds the web bundle. Migrations
should NOT run at build time on Vercel; run them from your laptop or CI
where you control the state (see §3).

### 4.3 First deploy

```bash
git push origin neon-reconnect
# Open PR on GitHub, merge to main, Vercel auto-deploys.
```

## 5. PostGIS hook (future)

Neon supports the `postgis` extension. When you're ready to add spatial
columns (e.g. replace `latitude`/`longitude` DOUBLE PRECISION columns with
a single `geom geometry(Point, 4326)` column), do this:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Then create a new Prisma migration that adds the geometry column and a
spatial index. Prisma 6 doesn't natively understand PostGIS types, so the
geometry column will need to be added via raw SQL in the migration file
(`migrations/<timestamp>_add_postgis_geom/migration.sql`), and queries
that touch it will use `prisma.$queryRaw` with `ST_*` functions.

## 6. Rollback

If Neon blows up in production and you need to revert to SQLite:

```bash
git checkout main
# Restore the archived SQLite migrations:
git checkout neon-reconnect -- docs/sqlite-migrations-archive/
mv docs/sqlite-migrations-archive/* prisma/migrations/
# Flip the schema back:
# (edit prisma/schema.prisma: provider = "sqlite", remove directUrl)
# Update .env: DATABASE_URL=file:./dev.db
npx prisma migrate deploy
```

The SQLite migration files are preserved in
`docs/sqlite-migrations-archive/` on this branch precisely so this
rollback is one `git checkout` away.

## 7. Troubleshooting matrix

| Symptom                                                                                  | Cause / Fix                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Environment variable not found: DIRECT_URL` on `prisma validate`                        | `.env` doesn't have `DIRECT_URL`. Copy from `.env.example`, fill in the Neon direct URL.                                                             |
| `Prisma needs to perform transactions` error from Vercel logs                            | The runtime URL is using the **direct** hostname instead of the pooler. Fix `DATABASE_URL` to use `-pooler` + `pgbouncer=true`.                       |
| `Error opening a TLS connection: ...` from `prisma migrate deploy`                       | The direct URL is missing `sslmode=require`. Add `?sslmode=require&channel_binding=require`.                                                          |
| `relation "Submission" already exists` when re-running migration                          | Migration was already applied. Check `_prisma_migrations` — if it's missing the row but tables exist, run `npm run db:resolve -- --applied 20260726120000_neon_postgres_init`. |
| `prisma migrate status` hangs / times out in sandbox                                       | Outbound port 5432 is blocked. Use `node scripts/_neon_verify.mjs` instead (HTTPS driver).                                                           |
| Connection works locally but Vercel deploy fails with `Can't reach database server`      | Vercel env vars not set, or set only for one environment (Production vs Preview vs Development). Set for all three.                                  |
| Neon shows 0 connections in dashboard even though app is serving requests                  | Pooler is warming up — Neon compute suspends when idle and resumes on first query (cold start ~300ms). Enable Neon's "Always-on" if cold starts hurt. |

## 8. Follow-up tasks (not on this branch)

- **Option 2** — Split monolithic `server.ts` (1,048 lines) into Vercel
  serverless routes under `api/`. The existing `api/sheet/` is the template.
- **Option 3** — Sheets→Neon sync script: when `/api/sheet/webhook` writes
  a row to Sheets, also write it to Neon so valuable submissions have a
  durable copy that survives Sheets' 50k-row ceiling.
- **Option 5** — Cloudflare R2 image pipeline: replace base64-inline photo
  uploads with presigned PUT to R2, store the resulting URL in `Photo.url`.
- **Option 6** — Full codebase audit: typecheck, dead code, dependency
  vulnerabilities, Capacitor Android config drift.
