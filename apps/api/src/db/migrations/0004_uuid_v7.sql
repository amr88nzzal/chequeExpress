-- 0004_uuid_v7.sql
-- `app_uuid_v7()` is defined in 0003, because `demo_items.id` needs it as a
-- column default and PostgreSQL resolves function references at DDL time. This
-- file re-states the definition so that the generator has a file of its own to
-- point at, and so a deployment that wants to swap in the built-in `uuidv7()` of
-- PostgreSQL 18 has exactly one place to do it.
--
-- WHY A WRAPPER FUNCTION AND NOT
-- `DEFAULT (CASE WHEN to_regprocedure('uuidv7()') IS NOT NULL THEN uuidv7() ELSE gen_random_uuid() END)`:
-- a column DEFAULT is evaluated once, at table-creation time, and stored as a
-- constant expression. That CASE would freeze a single uuid into the catalog and
-- every row inserted without an explicit id would collide on the primary key. A
-- function body is parsed at DDL time but evaluated per call, which is what the
-- default needs.
--
-- The application still generates its own UUIDv7 (`src/http/ids.ts`) and sends it
-- explicitly; this default is the fallback path, and it produces *ordered* ids,
-- unlike `gen_random_uuid()`.

CREATE OR REPLACE FUNCTION app_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
PARALLEL SAFE
AS $$
DECLARE
  unix_ts_ms bigint;
  rand_bytes bytea;
BEGIN
  unix_ts_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  rand_bytes := gen_random_bytes(10);

  rand_bytes := set_byte(rand_bytes, 0, ((unix_ts_ms >> 40) & 255)::int);
  rand_bytes := set_byte(rand_bytes, 1, ((unix_ts_ms >> 32) & 255)::int);
  rand_bytes := set_byte(rand_bytes, 2, ((unix_ts_ms >> 24) & 255)::int);
  rand_bytes := set_byte(rand_bytes, 3, ((unix_ts_ms >> 16) & 255)::int);
  rand_bytes := set_byte(rand_bytes, 4, ((unix_ts_ms >> 8) & 255)::int);
  rand_bytes := set_byte(rand_bytes, 5, (unix_ts_ms & 255)::int);

  rand_bytes := set_byte(rand_bytes, 6, (get_byte(rand_bytes, 6) & 15) | 112);
  rand_bytes := set_byte(rand_bytes, 8, (get_byte(rand_bytes, 8) & 63) | 128);

  RETURN encode(rand_bytes, 'hex')::uuid;
END
$$;

COMMENT ON FUNCTION app_uuid_v7() IS
  'UUIDv7 (RFC 9562) generator for PostgreSQL 17. Replace with the built-in uuidv7() on PostgreSQL 18.';

GRANT EXECUTE ON FUNCTION app_uuid_v7() TO cheques_app;
