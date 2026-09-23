-- 016_sandbox_sessions.sql
-- Sprint 5: Sandbox Sessions & gVisor Runtime Tracking

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES steps(id) ON DELETE SET NULL,

  profile_name text NOT NULL,
  runtime text NOT NULL,
  image_digest text NOT NULL,

  status text NOT NULL
    CHECK (
      status IN (
        'provisioning',
        'ready',
        'running',
        'collecting',
        'destroying',
        'destroyed',
        'failed',
        'cleanup_failed',
        'cancelled'
      )
    ),

  container_id text,
  workspace_path text,

  cpu_limit text NOT NULL,
  memory_limit text NOT NULL,
  pids_limit integer NOT NULL,
  network_mode text NOT NULL,
  allowed_hosts jsonb NOT NULL DEFAULT '[]'::jsonb,

  started_at timestamptz,
  finished_at timestamptz,
  destroyed_at timestamptz,
  failure_code text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sandbox_sessions_run_idx
ON sandbox_sessions (tenant_id, run_id, created_at DESC);

ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY sandbox_tenant_isolation
ON sandbox_sessions
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);
