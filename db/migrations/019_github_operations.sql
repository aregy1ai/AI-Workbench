-- 019_github_operations.sql
-- Sprint 5: GitHub Operations Idempotency & External Reference Tracking

CREATE TABLE IF NOT EXISTS github_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

  operation_type text NOT NULL
    CHECK (
      operation_type IN (
        'create_branch',
        'create_commit',
        'create_pull_request',
        'get_file',
        'get_tree'
      )
    ),

  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('started', 'succeeded', 'failed')),

  external_id text,
  external_url text,
  response_hash text,
  failure_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  UNIQUE (idempotency_key)
);

ALTER TABLE github_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_operations FORCE ROW LEVEL SECURITY;

CREATE POLICY github_operations_tenant_isolation
ON github_operations
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);
