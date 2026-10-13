# @cheques/api — C0 vertical slice (API)

The HTTP API of ChequeExpress: the C0 slice that pins down the two rules the whole
system rests on — **money is never a JavaScript number**, and **tenant data is
isolated in the database (RLS), not only in application code**.

References: `docs/CONVENTIONS.md` (§6 money, §7 layers, §8 tenancy/RLS, §13 API,
§14 security), `docs/DESIGN.md` (§3 data model, §9 SaaS, §10 security),
`docs/PLAN.md` (stage C0).

## What is here

```
apps/api
  package.json            scripts: dev test test:isolation typecheck migrate seed
  tsconfig.json           extends ../../tsconfig.base.json (strict, NodeNext, .ts specifiers)
  vitest.config.ts        pool: 'threads' (the sandbox denies piped-stdio children)
  src/
    main.ts               process entry point (config → db → app → listen)
    app.ts                Express app factory; all dependencies injected
    config/env.ts         Zod-validated environment (DATABASE_URL, PORT, LOG_LEVEL)
    config/cli-output.ts  the only place a CLI writes to stdout
    db/pool.ts            pg Pool + Kysely + CamelCasePlugin (lazy handle)
    db/types.ts           HAND-WRITTEN Kysely table types (see "Types" below)
    db/tenant-transaction.ts  withTenant(): transaction + SET LOCAL app.tenant_id
    db/migrate.ts         the migration runner (no migration library)
    db/migrate-cli.ts     `npm run migrate`
    db/seed.ts            two-tenant fixtures (+ seed-cli.ts for `npm run seed`)
    db/migrations/*.sql   sequential SQL migrations (0001…0005)
    demo/                 demo-items.{repository,service,routes}.ts — the three layers
    health/health.routes.ts   GET /health
    http/                 envelope, errors, error handler, requestId, tenant, logger
  test/
    unit.test.ts          pure logic: uuidv7, decimal strings (always run)
    migration-files.test.ts   static SQL rules (always run, no database)
    catalog-rules.test.ts     the super-test's detection logic vs fixtures (always run)
    http-envelope.test.ts     /health + error envelope (always run, no database)
    express-augment.types.test.ts  type-level guard on the Express augmentation
    isolation.test.ts     tenant isolation over HTTP      ─┐ need DATABASE_URL
    isolation-proof.test.ts  RLS proof at the database layer ├ else SKIPPED
    catalog-rls.test.ts      catalog super-test (pg_catalog) │
    db-types-drift.test.ts   hand-written types vs the schema ┘
    support/              test helpers (skip reason, catalog reader, app factory)
    manual-verify.ts      fallback runner, see "Running the tests" below
```

## The rules this slice implements

| Rule                                                                              | Where                                                                                                           |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Money is a decimal **string**, `numeric(18,4)` in the database                    | `db/migrations/0003_demo_items.sql`, `demo/demo-items.service.ts` (`decimalAmountSchema` rejects a JSON number) |
| Every data table: `tenant_id uuid NOT NULL` + index starting with it              | migrations `0003`, `0005`                                                                                       |
| RLS `ENABLE` **and** `FORCE` + a policy on `app_current_tenant()`                 | same migrations                                                                                                 |
| Application role is not owner, not superuser, not `BYPASSRLS`                     | `0001_roles.sql`                                                                                                |
| Every request transaction starts with `SET LOCAL app.tenant_id`                   | `db/tenant-transaction.ts` (`set_config(..., true)`, never plain `SET`)                                         |
| route → service → repository; the repository never opens a transaction            | `demo/demo-items.*.ts`                                                                                          |
| `{ data, meta }` / `{ error: { code, message, details, requestId } }`             | `http/envelope.ts`, `http/error-handler.ts`                                                                     |
| 404 for "not found" **and** for "out of scope"; 403 only for a missing permission | `demo/demo-items.service.ts`                                                                                    |
| pino JSON with `requestId` and `tenantId`, no account numbers or secrets          | `http/logger.ts`, `http/http-logger.ts`                                                                         |
| No `new Date()` in business logic: `ctx.clock` is injected                        | `http/clock.ts`                                                                                                 |

### The RLS policy and the role setup (exact SQL)

`src/db/migrations/0001_roles.sql`:

```sql
CREATE ROLE cheques_owner LOGIN PASSWORD '…';   -- owner / migrations (DDL)
CREATE ROLE cheques_app   LOGIN PASSWORD '…';   -- the API connects as this

ALTER ROLE cheques_app   NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE cheques_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;     -- the app role cannot add tables
GRANT USAGE ON SCHEMA public TO cheques_app;

CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid LANGUAGE sql STABLE PARALLEL SAFE
AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

GRANT EXECUTE ON FUNCTION app_current_tenant() TO cheques_app;
```

`src/db/migrations/0003_demo_items.sql` (the same block is repeated per table):

```sql
ALTER TABLE demo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_items FORCE  ROW LEVEL SECURITY;

CREATE POLICY demo_items_tenant_isolation ON demo_items
  USING      (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

REVOKE ALL ON TABLE demo_items FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demo_items TO cheques_app;
```

`0005_demo_attachments.sql` adds a composite foreign key
`(demo_item_id, tenant_id) REFERENCES demo_items (id, tenant_id)`, so a child row
cannot reference a parent in another tenant even if a policy were ever dropped.

The claim is written once, in `withTenant`:

```sql
SELECT set_config('app.tenant_id', $1, true)   -- true = transaction LOCAL
```

Fail-closed: with no claim, `app_current_tenant()` is `NULL`, every comparison is
unknown, and the query returns zero rows.

### Migrations and id generation

Files are applied in filename order, each in its own transaction, and each file's
SHA-256 is recorded in `schema_migrations`. Editing an applied migration makes the
runner fail — add a new file instead.

`demo_items.id` is a **UUIDv7 generated by the application** (`src/http/ids.ts`),
which the service always sends explicitly. The column `DEFAULT app_uuid_v7()` is a
fallback for rows inserted by hand or by a future service that forgets the id.
PostgreSQL 18 ships `uuidv7()`; this project pins **17** (see
`.github/workflows/ci.yml`), where that function does not exist, so `0003`/`0004`
provide an equivalent. That is why the default is a function and not
`CASE WHEN to_regprocedure('uuidv7()') IS NOT NULL …`: a column `DEFAULT` is
evaluated **once**, at table creation, and would freeze a single uuid into the
catalog.

### Types

`src/db/types.ts` is **hand-written**, mirroring the migrations. The target is
generated types (`kysely-codegen`) and this is the documented interim. Two guards
keep the mirror honest:

- `test/db-types-drift.test.ts` compares the column lists with
  `information_schema.columns`;
- `test/catalog-rls.test.ts` proves every one of those tables is tenant protected.

The design follows `CONVENTIONS.md` §4 (SQL `snake_case`, code `camelCase`,
translation by Kysely's `CamelCasePlugin`). Queries list their columns explicitly
instead of using `selectAll()`, so no result mapping is needed and the transport
shape stays explicit.

## Running the tests

```powershell
# from the repository root
npx tsc --noEmit -p apps/api/tsconfig.json
npx eslint apps/api
npx prettier --check apps/api
npx vitest run apps/api
```

### Which tests run, and which are skipped

| Suite                                                           | Needs PostgreSQL? | Local (no `DATABASE_URL`)                               |
| --------------------------------------------------------------- | ----------------- | ------------------------------------------------------- |
| `unit`, `migration-files`, `catalog-rules`, `http-envelope`     | no                | **run**                                                 |
| `isolation`, `isolation-proof`, `catalog-rls`, `db-types-drift` | yes               | **SKIPPED** with the reason `DATABASE_URL is not set …` |

A skipped test is a **skipped** test: it is reported as skipped and it proves
nothing. Read the next section if you need the isolation proof verified.

### Local runs on Windows (no Docker required if you install PostgreSQL)

1. Install PostgreSQL 17 (the EnterpriseDB Windows installer or `winget install
PostgreSQL.PostgreSQL.17`) or, if you prefer containers, Docker Desktop with
   `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17`.
2. Create the database and the two roles. The roles are created by migration
   `0001`, and it needs a role that may `CREATE ROLE` — a superuser for a local
   scratch database. Run as that superuser:

   ```sql
   CREATE DATABASE cheques_test;
   ```

   then point the runner at it:

   ```powershell
   $env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@127.0.0.1:5432/cheques_test"
   npm run migrate --workspace @cheques/api
   npm run seed    --workspace @cheques/api
   ```

3. Point the API and the tests at the **application** role (never the superuser:
   the isolation proof would be meaningless):

   ```powershell
   $env:DATABASE_URL = "postgres://cheques_app:cheques_app_dev_password@127.0.0.1:5432/cheques_test"
   npx vitest run apps/api
   npm run test:isolation --workspace @cheques/api   # just the isolation suites
   ```

   Both URLs point at the same database; they differ only in **which role**
   connects. The `cheques_app` role is a login role created by migration `0001`, so
   it can connect to a database owned by somebody else without any extra grant.

   In CI both variables are the same `postgres://postgres:…` service URL; migration
   `0001` creates the two roles there as well.

The passwords in `0001_roles.sql` are **development placeholders**. Any real
deployment must set the passwords out of band (`ALTER ROLE … PASSWORD :'secret'`)
and never commit them (`CONVENTIONS.md` §14).

### Proving the tests can fail (do this after a local run)

A green suite proves nothing if it cannot go red. With a database available:

```sql
-- 1. as the owner, drop FORCE and re-run `npx vitest run apps/api`
ALTER TABLE demo_items NO FORCE ROW LEVEL SECURITY;
--    expected: the catalog super-test fails with "[rls_forced] row level security
--    is not FORCED on demo_items"

-- 2. restore FORCE, then drop the policy instead
ALTER TABLE demo_items FORCE ROW LEVEL SECURITY;
DROP POLICY demo_items_tenant_isolation ON demo_items;
--    expected: "[policy] demo_items has tenant_id and RLS but no policy"

-- 3. add an unprotected table
CREATE TABLE scratch_unprotected (id uuid PRIMARY KEY);
--    expected: "[tenant_id] table "scratch_unprotected" has no tenant_id column…"
```

Restore afterwards (re-running `npm run migrate` does not restore dropped objects —
recreate them or restore the dump). The same detection logic is exercised on every
run, without a database, by `test/catalog-rules.test.ts`, which feeds the rules
synthetic snapshots that include unprotected fixture tables.

### `node` fallback runner

Two tools cannot start in the DSH sandbox on this development machine, because both
need esbuild to spawn a service process and the sandbox denies piped-stdio children
(`spawn EPERM`):

- **Vitest** — Vite's config loader fails at `bundleConfigFile`, so `npx vitest run
apps/api` does not even reach the test files here;
- **tsx** — which is why the scripts use plain `node`: Node 22 strips TypeScript
  types itself (the project requires Node ≥ 22.11) and every import in this app uses
  an explicit `.ts` specifier, so no loader is needed.

`test/manual-verify.ts` therefore runs the assertions of the database-free suites
with plain Node, so they can still be exercised locally:

```powershell
node apps/api/test/manual-verify.ts
```

It does **not** run the database suites and must never be reported as if it had.
The Vitest suites remain the source of truth and run in CI, where the sandbox does
not apply.

### CLI commands

```powershell
npm run migrate --workspace @cheques/api   # node src/db/migrate-cli.ts
npm run seed    --workspace @cheques/api   # node src/db/seed-cli.ts
npm run dev     --workspace @cheques/api   # node --watch src/main.ts
```

Without `DATABASE_URL` each fails immediately with
`Invalid configuration: databaseUrl: Required` (exit 1); with a URL that points at
no server it fails with `connect ECONNREFUSED …` after listing the migration files
it found, which is also a useful check that the SQL directory is complete.

## Environment variables

| Variable             | Used by           | Meaning                                                                  |
| -------------------- | ----------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`       | API, tests        | application role (`cheques_app`)                                         |
| `DATABASE_ADMIN_URL` | `migrate`, `seed` | owner/migration role; falls back to `DATABASE_URL`                       |
| `PORT`               | API               | default 3000                                                             |
| `LOG_LEVEL`          | API               | pino level, default `info`                                               |
| `NODE_ENV`           | API               | the development header identity resolver refuses to work in `production` |

No `.env` file is read: configuration comes from the environment only
(`CONVENTIONS.md` §14).

## Identity in this slice (deliberate stub)

Real identity (JWT, rotating refresh, 2FA) is C1. `src/http/tenant.ts` defines the
`IdentityResolver` seam, and `DevHeaderIdentityResolver` reads `x-tenant-id`,
`x-user-id`, and optional `x-scope-company-ids` / `x-scope-bank-account-ids`. It is
only mounted when `createApp` is given it, and it throws `401` when
`NODE_ENV=production`, so it cannot become an authentication bypass. Everything
downstream is written against the real `RequestContext` and will not change when
the JWT resolver replaces it.

## Not in this slice

Shops/companies/bank accounts, cheque lifecycle and state machine, permissions
(`requirePermission`), audit log, pg-boss jobs, OpenAPI generation, and the
`Idempotency-Key` handling — all later stages in `docs/PLAN.md`.
