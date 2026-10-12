-- C0 prototype: proves the tenant-isolation pattern every real table will copy (CONVENTIONS section 8).
-- These probe tables are dropped when the first real tables arrive in C1.

CREATE TABLE rls_probe_parents (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL,
  name       text NOT NULL,
  -- target of the composite FK below: a child can only point at a parent of the SAME tenant
  UNIQUE (tenant_id, id)
);

CREATE TABLE rls_probe_children (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL,
  parent_id  uuid NOT NULL,
  note       text NOT NULL,
  -- Composite FK on purpose: FK checks bypass RLS, so a plain FK on parent_id would let tenant A
  -- link to (and probe the existence of) tenant B's rows.
  FOREIGN KEY (tenant_id, parent_id) REFERENCES rls_probe_parents (tenant_id, id)
);

CREATE INDEX rls_probe_parents_tenant_idx ON rls_probe_parents (tenant_id, id);
CREATE INDEX rls_probe_children_tenant_idx ON rls_probe_children (tenant_id, id);

-- nullif(): after a transaction that used SET LOCAL, a pooled connection can report '' (not NULL) for the setting.
-- Empty or missing => NULL => the predicate is never true => no rows, and no cast error.
ALTER TABLE rls_probe_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_probe_parents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rls_probe_parents
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE rls_probe_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_probe_children FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rls_probe_children
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rls_probe_parents, rls_probe_children TO cheques_app;
