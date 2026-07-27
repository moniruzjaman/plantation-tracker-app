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
| `package.json`                                            | Added `db:deploy`, `db:status`, `db:resolve` scripts + `@neondatabase/serverless` dep + split `lint` into `lint:web` / `lint:api`. |
| `api/_lib/`                                               | Shared library for Vercel serverless routes: `prisma.ts`, `auth.ts`, `ai.ts`, `helpers.ts`. Cached on `globalThis` so warm invocations reuse the Prisma + Gemini clients. |
| `api/auth/`, `api/users/`, `api/seed/`, `api/sync.ts`, `api/submissions/`, `api/ai/`, `api/monitoring/`, `api/audit/`, `api/gee-ndvi.ts`, `api/health.ts` | Per-route Vercel serverless handlers, one file per route, lifted out of the monolithic `server.ts`. |
| `api/tsconfig.json`                                       | Standalone TypeScript config for the `api/` folder — Vercel compiles each route independently, so this is just for local `npm run lint:api`. |
| `tsconfig.json`                                           | Added `include` / `exclude` so the root config only typechecks `src/` + `server.ts` + `scripts/`. The api/ folder has its own config now. |
| `api/sheet/list.ts`                                       | Tiny type-safety fix: cast `gasRes.json()` spread target to `object` so `npm run lint:api` passes. |
| `NEON_RECONNECT.md`                                       | This file.                                                                     |

`server.ts` (1,048 lines) is preserved in the repo for **local dev only**
(`npm run dev` runs `tsx server.ts`). Vercel no longer needs it — every
`/api/*` route now has a dedicated serverless handler under `api/`. This
means each Neon query runs at the edge in a function that scales
independently, instead of all routes sharing one Express process.

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

- **Option 3** — Sheets→Neon sync script: when `/api/sheet/webhook` writes
  a row to Sheets, also write it to Neon so valuable submissions have a
  durable copy that survives Sheets' 50k-row ceiling.
- **Option 5** — Cloudflare R2 image pipeline: replace base64-inline photo
  uploads with presigned PUT to R2, store the resulting URL in `Photo.url`.
- **Option 6** — Full codebase audit: typecheck, dead code, dependency
  vulnerabilities, Capacitor Android config drift.

## 9. Serverless route map (Option 2 — done on this branch)

All 20 routes that lived in `server.ts` are now individual Vercel serverless
functions under `api/`. The shared code (Prisma singleton, allow-list loader,
Gemini singleton, helpers) lives in `api/_lib/` — folders prefixed with `_`
are excluded from Vercel's route auto-discovery.

| HTTP method + path                          | File                                       |
| ------------------------------------------- | ------------------------------------------ |
| `GET  /api/health`                          | `api/health.ts`                            |
| `GET  /api/sheet/list`                      | `api/sheet/list.ts` (pre-existing)         |
| `GET  /api/auth/bootstrap`                  | `api/auth/bootstrap.ts`                    |
| `POST /api/auth/profile`                    | `api/auth/profile.ts`                      |
| `GET  /api/auth/me`                         | `api/auth/me.ts`                           |
| `GET  /api/users`                           | `api/users/index.ts`                       |
| `GET  /api/seed/sync-status`                | `api/seed/sync-status.ts`                  |
| `POST /api/seed/sync`                       | `api/seed/sync.ts`                         |
| `POST /api/sync`                            | `api/sync.ts`                              |
| `GET  /api/submissions`                     | `api/submissions/index.ts`                 |
| `GET  /api/submissions/stats`               | `api/submissions/stats.ts`                 |
| `GET  /api/submissions/:id`                 | `api/submissions/[id].ts`                  |
| `DELETE /api/submissions/:id`               | `api/submissions/[id].ts`                  |
| `POST /api/ai/chat`                         | `api/ai/chat.ts`                           |
| `POST /api/ai/diagnose`                     | `api/ai/diagnose.ts`                       |
| `POST /api/gee-ndvi`                        | `api/gee-ndvi.ts`                          |
| `POST /api/monitoring/revisit`              | `api/monitoring/revisit.ts`                |
| `GET  /api/monitoring/:submissionId`        | `api/monitoring/[submissionId].ts`         |
| `GET  /api/audit/carbon-stock`              | `api/audit/carbon-stock.ts`                |
| `GET  /api/audit/export-geojson`            | `api/audit/export-geojson.ts`              |

### Conventions

- **Dynamic segments** use Next.js-style brackets: `[id].ts`, `[submissionId].ts`.
  Vercel prefers literal segments over dynamic ones, so `/api/submissions/stats`
  hits `stats.ts` (not `[id].ts`), and `/api/monitoring/revisit` hits
  `revisit.ts` (not `[submissionId].ts`).
- **`_lib` folder** is excluded from routing — Vercel's convention is that
  folders/files prefixed with `_` are treated as private modules.
- **Singletons** (Prisma, Gemini, allow-list) are cached on `globalThis` so
  warm Lambda containers reuse them across invocations. This is critical
  for Prisma — without it, every request would open a new connection to
  Neon and exhaust the pool.
- **CORS** is set per-handler via `setCorsHeaders(res)` from `_lib/helpers.ts`
  (the `vercel.json` `Access-Control-Allow-Origin: *` header covers static
  assets, but serverless functions need their own headers).
- **Body parsing** uses `parseBody(req)` from `_lib/helpers.ts` which handles
  both pre-parsed bodies (Vercel's default) and raw streams (some configs).
- **TypeScript**: each route is compiled independently by Vercel's
  `@vercel/node` builder. The `api/tsconfig.json` is only for local
  `npm run lint:api` — Vercel ignores it at build time.

### Smoke test after deploy

Once Vercel deploys this branch:

```bash
# Health check (should return {"status":"ok","database":"connected",...})
curl https://<your-vercel-domain>/api/health

# Bootstrap (should return the allow-list from seed/admins.json)
curl https://<your-vercel-domain>/api/auth/bootstrap

# Submissions stats (should return {"status":"success","stats":{...}})
curl https://<your-vercel-domain>/api/submissions/stats

# GeoJSON export (should return a FeatureCollection, possibly empty)
curl https://<your-vercel-domain>/api/audit/export-geojson
```

If any of these 404, check Vercel's "Functions" tab — the route file should
appear there with a deployment log. Common failure: a route file imports
something Vercel can't resolve (e.g. a Node-only module from a `src/` file
that wasn't moved into `api/_lib/`).
