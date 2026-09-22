-- 011_policy_decisions.sql
-- Policy Engine Decisions & Auditable Authorizations

CREATE TABLE IF NOT EXISTS policy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES steps(id) ON DELETE SET NULL,

  tool_name text NOT NULL,
  decision text NOT NULL
    CHECK (decision IN ('allow', 'deny', 'approval_required')),

  policy_version text NOT NULL,
  reason_code text NOT NULL,
  input_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE policy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY policy_decisions_tenant_isolation
ON policy_decisions
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE INDEX IF NOT EXISTS policy_decisions_tenant_run_idx
ON policy_decisions (tenant_id, run_id, created_at DESC);
