-- 023_tdi_evidence_relationships.sql
-- Strengthen TDI provenance after 022 without rewriting legacy array columns.
-- Junction tables are the authoritative evidence relationships for new writes.

ALTER TABLE tdi_scans
  ADD CONSTRAINT tdi_scans_scope_identity_uq
  UNIQUE (tenant_id, id, workspace_id, repository_id, commit_sha);

ALTER TABLE tdi_evidence
  ADD COLUMN IF NOT EXISTS evidence_key text;

UPDATE tdi_evidence
SET evidence_key = 'LEGACY-EVD-' || id::text
WHERE evidence_key IS NULL;

ALTER TABLE tdi_evidence
  ALTER COLUMN evidence_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tdi_evidence_key_uq
  ON tdi_evidence (tenant_id, evidence_key);

ALTER TABLE tdi_evidence
  DROP CONSTRAINT IF EXISTS tdi_evidence_scan_scope_fk;

ALTER TABLE tdi_evidence
  ADD CONSTRAINT tdi_evidence_scan_identity_fk
  FOREIGN KEY (tenant_id, scan_id, workspace_id, repository_id, commit_sha)
  REFERENCES tdi_scans (
    tenant_id, id, workspace_id, repository_id, commit_sha
  )
  ON DELETE CASCADE;

ALTER TABLE tdi_evidence
  ADD CONSTRAINT tdi_evidence_scan_id_identity_uq
  UNIQUE (tenant_id, scan_id, id);

ALTER TABLE tdi_findings
  ADD CONSTRAINT tdi_findings_scan_id_identity_uq
  UNIQUE (tenant_id, scan_id, id);

ALTER TABLE tdi_debt_records
  ADD CONSTRAINT tdi_debt_scan_id_identity_uq
  UNIQUE (tenant_id, scan_id, id);

ALTER TABLE tdi_decisions
  ADD COLUMN IF NOT EXISTS decision_fingerprint text
    CHECK (decision_fingerprint ~ '^sha256:[0-9a-f]{64}$');

CREATE TABLE IF NOT EXISTS tdi_finding_evidence (
  tenant_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  finding_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, scan_id, finding_id, evidence_id),

  CONSTRAINT tdi_fe_finding_fk
    FOREIGN KEY (tenant_id, scan_id, finding_id)
    REFERENCES tdi_findings (tenant_id, scan_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_fe_evidence_fk
    FOREIGN KEY (tenant_id, scan_id, evidence_id)
    REFERENCES tdi_evidence (tenant_id, scan_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tdi_debt_evidence (
  tenant_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  td_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, scan_id, td_id, evidence_id),

  CONSTRAINT tdi_de_fk
    FOREIGN KEY (tenant_id, scan_id, td_id)
    REFERENCES tdi_debt_records (tenant_id, scan_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_de_evidence_fk
    FOREIGN KEY (tenant_id, scan_id, evidence_id)
    REFERENCES tdi_evidence (tenant_id, scan_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tdi_fe_evidence_idx
  ON tdi_finding_evidence (tenant_id, scan_id, evidence_id);

CREATE INDEX IF NOT EXISTS tdi_de_evidence_idx
  ON tdi_debt_evidence (tenant_id, scan_id, evidence_id);

ALTER TABLE tdi_finding_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_finding_evidence FORCE ROW LEVEL SECURITY;

ALTER TABLE tdi_debt_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_debt_evidence FORCE ROW LEVEL SECURITY;

CREATE POLICY tdi_finding_evidence_tenant_isolation
ON tdi_finding_evidence
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tdi_debt_evidence_tenant_isolation
ON tdi_debt_evidence
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- tdi_findings.evidence_ids and tdi_debt_records.evidence_ids remain temporarily
-- for backward compatibility. New code must treat the junction tables as
-- authoritative relationships and keep the legacy arrays synchronized until
-- a future migration can remove them safely.
