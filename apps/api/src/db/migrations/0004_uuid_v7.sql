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
--
-- NO pgcrypto: an earlier revision called `gen_random_bytes(10)`, which lives in
-- the pgcrypto extension. Nothing in the migrations creates that extension, so
-- the default raised `42883 undefined_function` for every insert that did not
-- supply an id — the HTTP acceptance path returned 500. That was found by running
-- the migrations against a real PostgreSQL 17 server. The randomness now comes
-- from `gen_random_uuid()`, which has been in core since PostgreSQL 13, and the
-- bytes are assembled as hex characters so there is no byte-shuffling either.

CREATE OR REPLACE FUNCTION app_uuid_v7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT (
    -- 48-bit big-endian Unix millisecond timestamp, 12 hex characters.
    lpad(to_hex((floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)), 12, '0')
    -- RFC 9562 version 7 in the high nibble, then 12 random bits.
    || '7' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3)
    -- RFC 4122 variant in the top two bits (8,9,a,b), then 12 random bits.
    || substr('89ab', 1 + floor(random() * 4)::int, 1)
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3)
    -- 48 random bits.
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  )::uuid
$$;

COMMENT ON FUNCTION app_uuid_v7() IS
  'UUIDv7 (RFC 9562) generator for PostgreSQL 17. Replace with the built-in uuidv7() on PostgreSQL 18.';

GRANT EXECUTE ON FUNCTION app_uuid_v7() TO cheques_app;
