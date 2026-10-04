-- 022_technical_debt.sql
-- Eagle TDI v1: Technical Debt Intelligence Registry
-- Evidence-first, tenant-isolated, replayable technical-debt governance.

-- Tenant-scoped FK targets. Parent tables use globally unique UUID PKs, so
-- these composite unique indexes make tenant/resource scope enforceable by FK.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_tenant_id_uq
  ON workspaces (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS repositories_tenant_id_uq
  ON repositories (tenant_id, id);

CREATE TABLE IF NOT EXISTS tdi_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{7,64}$'),

  status text NOT NULL CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),

  collector_version text NOT NULL,
  analyzer_version text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_code text,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, repository_id, commit_sha, collector_version),

  CONSTRAINT tdi_scans_workspace_scope_fk
    FOREIGN KEY (tenant_id, workspace_id)
    REFERENCES workspaces (tenant_id, id),

  CONSTRAINT tdi_scans_repository_scope_fk
    FOREIGN KEY (tenant_id, repository_id)
    REFERENCES repositories (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tdi_scans_tenant_id_uq
  ON tdi_scans (tenant_id, id);

CREATE TABLE IF NOT EXISTS tdi_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,

  evidence_type text NOT NULL CHECK (
    evidence_type IN (
      'git',
      'static_analysis',
      'test',
      'dependency',
      'ci',
      'security',
      'architecture'
    )
  ),

  source text NOT NULL,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{7,64}$'),
  path text,
  line_start integer CHECK (line_start IS NULL OR line_start >= 1),
  line_end integer CHECK (line_end IS NULL OR line_end >= 1),
  collected_at timestamptz NOT NULL DEFAULT now(),
  content_digest text NOT NULL CHECK (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, id),

  CONSTRAINT tdi_evidence_scan_scope_fk
    FOREIGN KEY (tenant_id, scan_id)
    REFERENCES tdi_scans (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_evidence_workspace_scope_fk
    FOREIGN KEY (tenant_id, workspace_id)
    REFERENCES workspaces (tenant_id, id),

  CONSTRAINT tdi_evidence_repository_scope_fk
    FOREIGN KEY (tenant_id, repository_id)
    REFERENCES repositories (tenant_id, id),

  CONSTRAINT tdi_evidence_line_range_ck
    CHECK (line_end IS NULL OR line_start IS NULL OR line_end >= line_start)
);

CREATE INDEX IF NOT EXISTS tdi_evidence_scan_idx
  ON tdi_evidence (tenant_id, scan_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS tdi_evidence_repo_commit_idx
  ON tdi_evidence (tenant_id, repository_id, commit_sha);

CREATE TABLE IF NOT EXISTS tdi_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,

  finding_key text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'security',
      'architecture',
      'reliability',
      'performance',
      'testing',
      'documentation',
      'maintainability'
    )
  ),
  severity text NOT NULL CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  affected_paths text[] NOT NULL CHECK (cardinality(affected_paths) > 0),
  affected_symbols text[] NOT NULL DEFAULT '{}',

  recommendation text NOT NULL,
  explanation text,

  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'resolved', 'accepted', 'rejected')
  ),

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, scan_id, id),
  UNIQUE (tenant_id, scan_id, finding_key),

  CONSTRAINT tdi_findings_scan_scope_fk
    FOREIGN KEY (tenant_id, scan_id)
    REFERENCES tdi_scans (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_findings_workspace_scope_fk
    FOREIGN KEY (tenant_id, workspace_id)
    REFERENCES workspaces (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS tdi_findings_scan_idx
  ON tdi_findings (tenant_id, scan_id, severity, category);

CREATE TABLE IF NOT EXISTS tdi_debt_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,
  finding_id uuid NOT NULL,

  td_key text NOT NULL,
  affected_boundary text,

  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{7,64}$'),
  location_path text NOT NULL,
  location_symbols text[] NOT NULL DEFAULT '{}',

  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^sha256:[0-9a-f]{64}$'),

  category text NOT NULL CHECK (
    category IN (
      'security',
      'architecture',
      'reliability',
      'performance',
      'testing',
      'documentation',
      'maintainability'
    )
  ),
  severity text NOT NULL CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  impact numeric(5,2) NOT NULL CHECK (impact >= 0 AND impact <= 10),
  risk numeric(7,4) NOT NULL CHECK (risk >= 0),
  change_frequency numeric(12,3) NOT NULL CHECK (change_frequency >= 0),
  remediation_effort_hours numeric(12,3) NOT NULL CHECK (remediation_effort_hours >= 0),
  debt_score numeric(18,4) NOT NULL CHECK (debt_score >= 0),

  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'resolved', 'accepted', 'rejected')
  ),

  created_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  closed_at timestamptz,

  owner text,
  adr text,
  accepted boolean NOT NULL DEFAULT false,
  review_due_at timestamptz,

  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, td_key),

  CONSTRAINT tdi_debt_finding_scope_fk
    FOREIGN KEY (tenant_id, scan_id, finding_id)
    REFERENCES tdi_findings (tenant_id, scan_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_debt_scan_scope_fk
    FOREIGN KEY (tenant_id, scan_id)
    REFERENCES tdi_scans (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_debt_workspace_scope_fk
    FOREIGN KEY (tenant_id, workspace_id)
    REFERENCES workspaces (tenant_id, id),

  CONSTRAINT tdi_debt_repository_scope_fk
    FOREIGN KEY (tenant_id, repository_id)
    REFERENCES repositories (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS tdi_debt_priority_idx
  ON tdi_debt_records (tenant_id, debt_score DESC, severity, status);

CREATE INDEX IF NOT EXISTS tdi_debt_boundary_idx
  ON tdi_debt_records (tenant_id, affected_boundary, severity);

CREATE TABLE IF NOT EXISTS tdi_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  td_id uuid NOT NULL,

  decision text NOT NULL CHECK (decision IN ('PASS', 'REVIEW', 'BLOCK')),
  policy_applied text NOT NULL,
  policy_version text NOT NULL,
  evidence_verified boolean NOT NULL,
  reason_code text NOT NULL,
  reason text NOT NULL,

  decided_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, id),

  CONSTRAINT tdi_decisions_td_scope_fk
    FOREIGN KEY (tenant_id, td_id)
    REFERENCES tdi_debt_records (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT tdi_decisions_workspace_scope_fk
    FOREIGN KEY (tenant_id, workspace_id)
    REFERENCES workspaces (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS tdi_decisions_td_time_idx
  ON tdi_decisions (tenant_id, td_id, decided_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE tdi_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_scans FORCE ROW LEVEL SECURITY;

ALTER TABLE tdi_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_evidence FORCE ROW LEVEL SECURITY;

ALTER TABLE tdi_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_findings FORCE ROW LEVEL SECURITY;

ALTER TABLE tdi_debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_debt_records FORCE ROW LEVEL SECURITY;

ALTER TABLE tdi_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdi_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY tdi_scans_tenant_isolation
ON tdi_scans
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tdi_evidence_tenant_isolation
ON tdi_evidence
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tdi_findings_tenant_isolation
ON tdi_findings
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tdi_debt_tenant_isolation
ON tdi_debt_records
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tdi_decisions_tenant_isolation
ON tdi_decisions
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Explicitly index the tenant-scoped foreign-key access paths used by RLS
CREATE INDEX IF NOT EXISTS tdi_evidence_tenant_scan_idx
  ON tdi_evidence (tenant_id, scan_id);

CREATE INDEX IF NOT EXISTS tdi_findings_tenant_scan_idx
  ON tdi_findings (tenant_id, scan_id);

CREATE INDEX IF NOT EXISTS tdi_debt_tenant_finding_idx
  ON tdi_debt_records (tenant_id, finding_id);

CREATE INDEX IF NOT EXISTS tdi_debt_tenant_scan_idx
  ON tdi_debt_records (tenant_id, scan_id);

CREATE INDEX IF NOT EXISTS tdi_decisions_tenant_td_idx
  ON tdi_decisions (tenant_id, td_id);
