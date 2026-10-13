# ADR 0001 — Tenant isolation with PostgreSQL row level security

* **Status:** accepted
* **Date:** 2026-10-13
* **Stage:** C0 (the slice this decision is proven by)
* **References:** `docs/CONVENTIONS.md` §8 (tenancy and RLS), §9 (permissions and
  scope), §14 (security); `docs/DESIGN.md` §3 (data model), §9 (SaaS), §10
  (security); `docs/PLAN.md` stage C0.
* **Code:** `apps/api/src/db/migrations/0001_roles.sql`,
  `0003_demo_items.sql`, `0005_demo_attachments.sql`;
  `apps/api/src/db/tenant-transaction.ts`; `apps/api/src/demo/*`; tests
  `apps/api/test/isolation.test.ts`, `isolation-proof.test.ts`,
  `catalog-rls.test.ts`.

## Context

ChequeExpress is multi-tenant from its first table: one deployment serves many
independent customers (companies with their own bank accounts, cheque books and
issued cheques). A cross-tenant read is not a cosmetic bug — it exposes another
customer's payees, amounts and bank accounts. The system also handles money, so a
silent wrong-answer failure is worse than a crash.

Constraints that shaped the decision:

* the codebase is layered `route → service → repository`
  (`CONVENTIONS.md` §7), and a repository takes only a `ctx` that carries the
  transaction;
* `CONVENTIONS.md` §8 already states the rule: "tenant isolation in the database,
  not only in the code … do not rely on remembering `WHERE tenant_id`", plus
  `tenant_id uuid NOT NULL` on every data table, RLS enabled on every table, and a
  super-test that fails CI when a table is added without protection;
* the application connects with a role that is **not** the owner, **not** a
  superuser and **not** `BYPASSRLS`, while migrations run as a separate role;
* one PostgreSQL instance and one schema for the whole deployment (the product is
  sold as a SaaS on a private server, not as per-customer appliances).

## Decision

Isolation is enforced **in PostgreSQL with row level security**, and the
application is written so that it cannot accidentally opt out:

1. every data table has `tenant_id uuid NOT NULL` and an index whose first column
   is `tenant_id`;
2. every data table has `ALTER TABLE … ENABLE ROW LEVEL SECURITY` **and**
   `FORCE ROW LEVEL SECURITY`, with a policy
   `USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant())`;
3. `app_current_tenant()` is
   `NULLIF(current_setting('app.tenant_id', true), '')::uuid` — transaction-local,
   fail-closed (`NULL` matches nothing);
4. every request transaction begins with
   `SELECT set_config('app.tenant_id', $1, true)` (never plain `SET`, which would
   leak across requests in a pool), issued by `withTenant()`, the only place in the
   codebase that writes the claim;
5. the application role is `NOSUPERUSER NOBYPASSRLS`, owns nothing, and may not
   create objects in `public`;
6. repositories also write `WHERE tenant_id = ctx.tenantId` explicitly. This is
   redundant for correctness and is kept deliberately: it is the readable intent,
   it lets the tenant index do the work, and it means a missing policy fails a test
   instead of leaking data;
7. the catalog super-test (`test/catalog-rls.test.ts`) queries `pg_catalog` and
   fails when any table in `public` outside the explicit global allow-list
   (`countries`, `currencies`, `banks`, `platform_cheque_layouts`,
   `schema_migrations`) lacks `tenant_id`, RLS enabled, RLS forced or a policy.

## Alternatives considered

### (a) Application-level filtering only (`WHERE tenant_id = ?` in every query)

* **For:** simplest; no policies to write; no dependence on database features;
  works identically on any SQL engine.
* **Against:** the guarantee is only as good as the least careful query. One
  forgotten predicate, one ad-hoc report, one `SELECT *` in a script, one future
  `JOIN`, and data leaks — and nothing fails. The project's own convention says not
  to rely on remembering the predicate. It also cannot protect a table that is read
  by a future service or by an operator's `psql` session.
* **Verdict:** rejected as the *mechanism*. It is retained as a readable,
  index-friendly redundancy (decision point 6 above).

### (b) One schema per tenant (`tenant_a.issued_cheques`, …)

* **For:** isolation is structural; a query cannot accidentally name another
  tenant's table; per-tenant `pg_dump`/restore and per-tenant grants come for free.
* **Against:** every migration must be applied N times and must be transactional
  across schemas; connection pooling must set `search_path` per request (the same
  leak risk as `SET` above, but with a bigger blast radius); `pg_catalog` queries,
  cross-tenant platform tables and ordinary reporting become awkward; the schema
  count becomes an operational limit at hundreds of tenants; the per-tenant
  `search_path` switch defeats prepared-statement caching.
* **Verdict:** rejected. It trades a per-query predicate for a per-request session
  switch, and it makes migrations, which are already the riskiest routine
  operation, N times more likely to diverge.

### (c) One database (or one cluster) per tenant

* **For:** the strongest isolation available: separate credentials, separate
  backups, separate resource limits, no shared query planner state.
* **Against:** migrations and schema drift must be managed across instances; no
  cross-tenant reporting or platform library without a federation layer; connection
  pool and backup costs scale with tenants; backups and restore drills multiply;
  onboarding a tenant becomes a provisioning job rather than a transaction.
* **Verdict:** rejected for this product's scale, and it conflicts with the
  platform-level template library and country packs in `DESIGN.md` §9. It remains
  the right answer for a single enterprise customer with its own server, which is
  a deployment variant rather than a schema decision.

### (d) A separate query layer / ORM-level tenancy filter / connection proxy

* **For:** keeps the database simple; tenancy is visible in one place in the
  application.
* **Against:** it is (a) with extra machinery: the guarantee still lives in code
  that can be bypassed by raw SQL, and it adds a component (proxy) whose failure
  mode is a full leak. Rejected.

## Consequences

### Positive

* A cross-tenant read requires actively disabling a database guard, not merely
  forgetting a predicate. `FORCE` means even the table owner is subject to the
  policy, so a migration run by the wrong role does not open a hole.
* The invariant is machine-checked: a new table without the tenant quartet fails
  `catalog-rls.test.ts` in CI, and the detection logic itself is unit-tested
  against synthetic unprotected tables.
* The isolation proof is direct: with the application role, a query with **no**
  `WHERE tenant_id` returns only the current tenant's rows
  (`test/isolation-proof.test.ts`), and a row whose `tenant_id` is not the claimed
  tenant is rejected with `SQLSTATE 42501`.
* The API answers **404**, not 403, for a row that exists in another tenant, so a
  tenant cannot probe for identifiers (`CONVENTIONS.md` §9).

### Negative and costs

* **Performance.** PostgreSQL adds the policy predicate to every statement that
  touches the table; the plan for an unfiltered query becomes an index scan on
  `(tenant_id, …)` and, for writes, a `WITH CHECK` evaluation per row. The cost is
  bounded but not zero, and it is invisible until measured. Measurement plan:
  `EXPLAIN (ANALYZE, BUFFERS)` on the hot statements (list by tenant + cursor,
  insert, status update) with and without `ENABLE ROW LEVEL SECURITY`, at 10⁴,
  10⁵ and 10⁶ rows per tenant, in CI as a report (not a hard gate, to avoid
  flaky assertions). The rule of thumb we will verify: the policy predicate is a
  leading-equality filter on the tenant index, so it should turn a sequential scan
  into an index scan rather than add work.
* **Index discipline.** The first column of every tenant index must be
  `tenant_id`, otherwise the policy predicate cannot be pushed down. This is a
  review rule and a drift-test candidate for C1.
* **Operational sharp edges.** `SET LOCAL` must be used inside an explicit
  transaction: `withTenant()` therefore owns the transaction, and a repository can
  never open one (`CONVENTIONS.md` §7). `pg_dump`/`pg_restore` and ad-hoc `psql`
  sessions run as a role that bypasses RLS by ownership or superuser rights — that
  is intended for operations, and it means break-glass access must be audited
  (`CONVENTIONS.md` §15).
* **Migration ordering.** Roles and `app_current_tenant()` must exist before the
  first tenant table (`0001` before `0003`), and a policy cannot be created before
  RLS is enabled. The migration runner enforces order; a checksum mismatch on an
  applied file aborts the run.
* **Testing requires a real PostgreSQL.** RLS cannot be proven against a mock or
  an in-memory database. On a machine without PostgreSQL the suites are visibly
  **skipped**; the real proof runs in GitHub Actions against a `postgres:17`
  service. Until CI has run, the isolation proof is *not verified* — that status is
  recorded in the delivery report rather than hidden behind a green local run.
* **Escape hatches must stay closed.** `BYPASSRLS` is not granted to the
  application role; `REVOKE CREATE ON SCHEMA public FROM PUBLIC` prevents the
  application from materialising a table outside the catalog super-test's view; and
  `FORCE` keeps the owner inside the policy. Each of these is asserted by a test or
  by the role-attribute checks in `isolation-proof.test.ts`.

## Follow-ups

* C1: apply the same quartet to `tenants`, `users`, `memberships`, `roles`,
  `permissions`, `role_permissions`, `role_assignments`, `audit_logs`, `files`,
  `settings`, `notifications`, `job_runs`; keep the global allow-list explicit.
* C1: replace the development header identity resolver with the real JWT resolver
  and populate `ctx.scope` from `role_assignments`.
* C1: add the RLS benchmark report described above to CI.
* C2+: consider PostgreSQL 18 (`uuidv7()`) once the deployment image moves, and
  drop `app_uuid_v7()`.
