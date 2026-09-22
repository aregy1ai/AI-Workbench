-- 010_tool_calls.sql
-- Tool Execution Lifecycle, Idempotency and State Management

CREATE TABLE IF NOT EXISTS tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES steps(id) ON DELETE CASCADE,

  tool_name text NOT NULL,
  tool_version text NOT NULL,

  status text NOT NULL
    CHECK (
      status IN (
        'requested',
        'policy_checking',
        'requires_approval',
        'approved',
        'credentials_issued',
        'executing',
        'succeeded',
        'failed',
        'timed_out',
        'cancelled',
        'rejected'
      )
    ),

  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result_hash text,

  policy_decision_id uuid,
  approval_id uuid,
  secret_lease_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,

  UNIQUE (idempotency_key)
);

ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls FORCE ROW LEVEL SECURITY;

CREATE POLICY tool_calls_tenant_isolation
ON tool_calls
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE INDEX IF NOT EXISTS tool_calls_tenant_run_idx
ON tool_calls (tenant_id, run_id, created_at DESC);
