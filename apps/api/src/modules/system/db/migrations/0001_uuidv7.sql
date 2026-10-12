-- UUIDv7 (time-ordered) for PostgreSQL < 18, which has no native uuidv7().
-- 48-bit unix-ms timestamp + random bits; version nibble forced to 7. Replaced by the native function on PG 18+.
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;
GRANT EXECUTE ON FUNCTION uuidv7() TO cheques_app;
