-- 0005_demo_attachments.sql
-- The second tenant data table. It exists so that the catalog super-test has more
-- than one table to judge, and so that the isolation test can prove a
-- child record cannot be reached across tenants either.
--
-- It is deliberately plain: tenant_id, an index starting with tenant_id, a
-- composite foreign key on (demo_item_id, tenant_id) — which makes a cross-tenant
-- attachment structurally impossible, not just policy-forbidden — ENABLE + FORCE
-- row level security, and the same tenant policy as every other table.

CREATE TABLE IF NOT EXISTS demo_attachments (
  id            uuid        NOT NULL DEFAULT app_uuid_v7(),
  tenant_id     uuid        NOT NULL,
  demo_item_id  uuid        NOT NULL,
  file_name     text        NOT NULL,
  byte_size     integer     NOT NULL CHECK (byte_size >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT demo_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT demo_attachments_file_name_not_blank CHECK (length(btrim(file_name)) > 0),

  -- Composite FK: the referenced demo_items row must belong to the same tenant.
  CONSTRAINT demo_attachments_item_same_tenant_fkey
    FOREIGN KEY (demo_item_id, tenant_id)
    REFERENCES demo_items (id, tenant_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS demo_attachments_tenant_id_idx
  ON demo_attachments (tenant_id);
CREATE INDEX IF NOT EXISTS demo_attachments_tenant_item_idx
  ON demo_attachments (tenant_id, demo_item_id);

COMMENT ON TABLE demo_attachments IS
  'C0 second tenant table; proves the catalog super-test judges every new table.';
COMMENT ON CONSTRAINT demo_attachments_item_same_tenant_fkey ON demo_attachments IS
  'Composite key (demo_item_id, tenant_id): a parent in another tenant cannot be referenced.';

ALTER TABLE demo_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demo_attachments_tenant_isolation ON demo_attachments;

CREATE POLICY demo_attachments_tenant_isolation ON demo_attachments
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

REVOKE ALL ON TABLE demo_attachments FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demo_attachments TO cheques_app;
