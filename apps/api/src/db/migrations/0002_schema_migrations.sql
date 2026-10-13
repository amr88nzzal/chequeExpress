-- 0002_schema_migrations.sql
-- The migration ledger. It is infrastructure, not tenant data: it records which
-- files have run, for every tenant at once, and the API never reads it as data.
--
-- It is therefore on the explicit allow-list of the catalog super-test
-- (test/support/catalog-rules.ts), together with countries/currencies/banks-style
-- global tables. The allow-list is the mechanism that keeps "every table is
-- protected" falsifiable instead of a blanket exception: a new tenant table that
-- is not on the list fails the test.
--
-- The application role gets SELECT and nothing else. It never writes the ledger,
-- but it does read it: the integration test helper asserts that every migration
-- present on disk has been applied before the acceptance tests run, so a stale
-- local database fails with "migration 0005 is not applied" instead of a
-- confusing "relation does not exist".
--
-- This table holds no tenant data: version strings and checksums only.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text        PRIMARY KEY,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS
  'Migration ledger. Global infrastructure table, on the catalog test allow-list.';

REVOKE ALL ON TABLE schema_migrations FROM PUBLIC;
REVOKE ALL ON TABLE schema_migrations FROM cheques_app;
GRANT SELECT ON TABLE schema_migrations TO cheques_app;
