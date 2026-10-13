-- 0001_roles.sql
-- Roles, and the one function that every tenant policy calls.
--
-- Two roles, per docs/CONVENTIONS.md 8 and 18:
--   cheques_owner : owns the schema and every object; runs migrations; the only
--                   role that may DDL. This is the role DATABASE_ADMIN_URL uses.
--   cheques_app   : the role the API connects as. NOSUPERUSER NOBYPASSRLS, and it
--                   is granted no ownership of anything, so PostgreSQL cannot
--                   exempt it from row level security. (Table owners bypass their
--                   own policies unless FORCE is set; keeping the app role out of
--                   the owner list is the second half of that guard.)
--
-- Role names are deployment-wide, so they are created idempotently and their
-- attributes are re-asserted on every migration run: an operator who flipped a
-- flag by hand does not get to keep it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cheques_owner') THEN
    CREATE ROLE cheques_owner LOGIN PASSWORD 'cheques_owner_dev_password';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cheques_app') THEN
    CREATE ROLE cheques_app LOGIN PASSWORD 'cheques_app_dev_password';
  END IF;
END
$$;

-- Fail closed: if a role already existed with the wrong attributes, fix it here.
ALTER ROLE cheques_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE cheques_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

-- The application schema is `public` in this slice. Nobody except the owner may
-- create objects in it, so the application role cannot materialise a table that
-- the catalog super-test has not seen.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cheques_app;

-- Note on grants: every table migration grants explicitly to cheques_app rather
-- than relying on ALTER DEFAULT PRIVILEGES, because the migrations may be run
-- either by cheques_owner (production/CI) or by the bootstrap superuser (a fresh
-- local database), and FOR ROLE default privileges only fire for the named role.
-- Explicit grants behave identically in both cases.

-- ---------------------------------------------------------------------------
-- app_current_tenant()
--
-- The single tenant accessor every policy uses. It reads the transaction-local
-- claim written by `withTenant` (src/db/tenant-transaction.ts):
--
--     select set_config('app.tenant_id', $1, true)
--
-- `current_setting('app.tenant_id', true)` returns NULL instead of raising when
-- the setting has never been set in this session, and NULLIF turns the empty
-- string left behind by a pooler into NULL as well. The cast to uuid means a
-- malformed claim raises rather than matching anything.
--
-- Fail-closed: when the claim is NULL the comparison `tenant_id = NULL` is never
-- true, so no row is visible and no row can be inserted.
--
-- It is STABLE (not IMMUTABLE) because it depends on the session state, and it is
-- SECURITY INVOKER: a policy that was SECURITY DEFINER could be abused to read
-- another tenant's rows by a future caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_tenant() IS
  'Tenant claim of the current transaction, set by SET LOCAL app.tenant_id. NULL when unset (fail closed).';

GRANT EXECUTE ON FUNCTION app_current_tenant() TO cheques_app;
