-- 024_tdi_text_identity.sql
-- Align TDI entity identifiers with the public TypeScript contracts.
-- scan_id remains a database UUID; Evidence/Finding/Debt/Decision ids are
-- deterministic text identities such as EVD-..., FND-..., TD-..., DEC-....

-- Remove foreign keys/indexed relationships that depend on the UUID identity
-- columns before changing their underlying types.
ALTER TABLE tdi_decisions
  DROP CONSTRAINT IF EXISTS tdi_decisions_td_scope_fk;

ALTER TABLE tdi_debt_evidence
  DROP CONSTRAINT IF EXISTS tdi_de_td_fk,
  DROP CONSTRAINT IF EXISTS tdi_de_evidence_fk;

ALTER TABLE tdi_debt_records
  DROP CONSTRAINT IF EXISTS tdi_debt_finding_scope_fk;

ALTER TABLE tdi_finding_evidence
  DROP CONSTRAINT IF EXISTS tdi_fe_finding_fk,
  DROP CONSTRAINT IF EXISTS tdi_fe_evidence_fk;

ALTER TABLE tdi_findings
  DROP CONSTRAINT IF EXISTS tdi_findings_workspace_scope_fk;

ALTER TABLE tdi_evidence
  DROP CONSTRAINT IF EXISTS tdi_evidence_scan_identity_fk,
  DROP CONSTRAINT IF EXISTS tdi_evidence_scan_scope_fk;

-- Entity identities: UUID -> text.
ALTER TABLE tdi_evidence
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE tdi_findings
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE tdi_debt_records
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE tdi_decisions
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

-- References between TDI entities follow the same contract identity.
ALTER TABLE tdi_findings
  ALTER COLUMN evidence_ids TYPE text[]
  USING ARRAY(
    SELECT value::text FROM unnest(evidence_ids) AS value
  );

ALTER TABLE tdi_debt_records
  ALTER COLUMN finding_id TYPE text USING finding_id::text,
  ALTER COLUMN evidence_ids TYPE text[]
  USING ARRAY(
    SELECT value::text FROM unnest(evidence_ids) AS value
  );

ALTER TABLE tdi_decisions
  ALTER COLUMN td_id TYPE text USING td_id::text;

ALTER TABLE tdi_finding_evidence
  ALTER COLUMN finding_id TYPE text USING finding_id::text,
  ALTER COLUMN evidence_id TYPE text USING evidence_id::text;

ALTER TABLE tdi_debt_evidence
  ALTER COLUMN td_id TYPE text USING td_id::text,
  ALTER COLUMN evidence_id TYPE text USING evidence_id::text;

-- Recreate authoritative scoped relationships.
ALTER TABLE tdi_evidence
  ADD CONSTRAINT tdi_evidence_scan_identity_fk
  FOREIGN KEY (tenant_id, scan_id, workspace_id, repository_id, commit_sha)
  REFERENCES tdi_scans (
    tenant_id, id, workspace_id, repository_id, commit_sha
  )
  ON DELETE CASCADE;

ALTER TABLE tdi_findings
  ADD CONSTRAINT tdi_findings_scan_scope_fk
  FOREIGN KEY (tenant_id, scan_id)
  REFERENCES tdi_scans (tenant_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_findings
  ADD CONSTRAINT tdi_findings_workspace_scope_fk
  FOREIGN KEY (tenant_id, workspace_id)
  REFERENCES workspaces (tenant_id, id);

ALTER TABLE tdi_finding_evidence
  ADD CONSTRAINT tdi_fe_finding_fk
  FOREIGN KEY (tenant_id, scan_id, finding_id)
  REFERENCES tdi_findings (tenant_id, scan_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_finding_evidence
  ADD CONSTRAINT tdi_fe_evidence_fk
  FOREIGN KEY (tenant_id, scan_id, evidence_id)
  REFERENCES tdi_evidence (tenant_id, scan_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_debt_records
  ADD CONSTRAINT tdi_debt_finding_scope_fk
  FOREIGN KEY (tenant_id, scan_id, finding_id)
  REFERENCES tdi_findings (tenant_id, scan_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_debt_evidence
  ADD CONSTRAINT tdi_de_td_fk
  FOREIGN KEY (tenant_id, scan_id, td_id)
  REFERENCES tdi_debt_records (tenant_id, scan_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_debt_evidence
  ADD CONSTRAINT tdi_de_evidence_fk
  FOREIGN KEY (tenant_id, scan_id, evidence_id)
  REFERENCES tdi_evidence (tenant_id, scan_id, id)
  ON DELETE CASCADE;

ALTER TABLE tdi_decisions
  ADD CONSTRAINT tdi_decisions_td_scope_fk
  FOREIGN KEY (tenant_id, td_id)
  REFERENCES tdi_debt_records (tenant_id, id)
  ON DELETE CASCADE;

-- Contract-level identity constraints.
ALTER TABLE tdi_evidence
  ADD CONSTRAINT tdi_evidence_id_format_ck
  CHECK (length(id) > 0);

ALTER TABLE tdi_findings
  ADD CONSTRAINT tdi_findings_id_format_ck
  CHECK (id ~ '^FND-[A-Za-z0-9][A-Za-z0-9._-]*$');

ALTER TABLE tdi_debt_records
  ADD CONSTRAINT tdi_debt_id_format_ck
  CHECK (id ~ '^TD-[A-Za-z0-9][A-Za-z0-9._-]*$');

ALTER TABLE tdi_decisions
  ADD CONSTRAINT tdi_decisions_id_format_ck
  CHECK (id ~ '^DEC-[A-Za-z0-9][A-Za-z0-9._-]*$');

ALTER TABLE tdi_debt_records
  ADD CONSTRAINT tdi_debt_finding_identity_uq
  UNIQUE (tenant_id, scan_id, finding_id);

ALTER TABLE tdi_decisions
  ADD CONSTRAINT tdi_decisions_td_time_uq
  UNIQUE (tenant_id, td_id, decided_at);
