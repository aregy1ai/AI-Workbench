-- 013_secret_leases.sql
-- Short-Lived Scoped Secret Leases with Automatic Revocation

CREATE TABLE IF NOT EXISTS secret_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_call_id uuid REFERENCES tool_calls(id) ON DELETE SET NULL,

  secret_type text NOT NULL,
  provider text NOT NULL,
  scope jsonb NOT NULL,

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),

  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

ALTER TABLE secret_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_leases FORCE ROW LEVEL SECURITY;

CREATE POLICY secret_leases_tenant_isolation
ON secret_leases
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE INDEX IF NOT EXISTS secret_leases_tenant_run_idx
ON secret_leases (tenant_id, run_id, expires_at);
