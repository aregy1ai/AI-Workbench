-- 012_approvals.sql
-- Human-in-the-Loop Approval Queue & Decision Audits

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES steps(id) ON DELETE SET NULL,
  tool_call_id uuid REFERENCES tool_calls(id) ON DELETE CASCADE,

  approval_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'approved',
        'rejected',
        'expired',
        'cancelled'
      )
    ),

  requested_by text NOT NULL,
  decided_by uuid REFERENCES users(id),
  reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  decided_at timestamptz
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

CREATE POLICY approvals_tenant_isolation
ON approvals
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE INDEX IF NOT EXISTS approvals_tenant_status_idx
ON approvals (tenant_id, status, created_at DESC);
