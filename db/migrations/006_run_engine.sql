-- 006_run_engine.sql
-- Core Run Engine Tables, Leases, RLS, and Composite Indexes

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) >= 3),
  description text NOT NULL,
  base_branch text NOT NULL DEFAULT 'main',
  requested_by uuid NOT NULL REFERENCES users(id),
  risk_level text NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'created'
    CHECK (
      status IN (
        'created',
        'queued',
        'running',
        'waiting_approval',
        'cancellation_requested',
        'cancelling',
        'succeeded',
        'failed',
        'cancelled',
        'cancel_failed'
      )
    ),

  version bigint NOT NULL DEFAULT 0,
  cancellation_epoch bigint NOT NULL DEFAULT 0,

  runtime_name text NOT NULL,
  runtime_version text NOT NULL,

  budget_limit numeric(18, 8) NOT NULL CHECK (budget_limit >= 0),
  budget_reserved numeric(18, 8) NOT NULL DEFAULT 0,
  budget_consumed numeric(18, 8) NOT NULL DEFAULT 0,

  worker_id text,
  worker_lease_expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  failure_code text,
  failure_message text
);

CREATE TABLE IF NOT EXISTS steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

  sequence integer NOT NULL CHECK (sequence >= 0),
  type text NOT NULL
    CHECK (type IN ('reasoning', 'tool_call', 'approval', 'checkpoint')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'running',
        'waiting',
        'succeeded',
        'failed',
        'cancelled'
      )
    ),

  attempt integer NOT NULL DEFAULT 0,
  input_hash text NOT NULL,
  output_hash text,

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,

  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS worker_leases (
  run_id uuid PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  lease_token text NOT NULL UNIQUE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operation_deduplication (
  idempotency_key text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- RLS Enforcement
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;

ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps FORCE ROW LEVEL SECURITY;

ALTER TABLE worker_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_leases FORCE ROW LEVEL SECURITY;

ALTER TABLE operation_deduplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_deduplication FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tasks_tenant_isolation
ON tasks
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE POLICY runs_tenant_isolation
ON runs
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE POLICY steps_tenant_isolation
ON steps
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE POLICY leases_tenant_isolation
ON worker_leases
USING (
  EXISTS (
    SELECT 1
    FROM runs
    WHERE runs.id = worker_leases.run_id
      AND runs.tenant_id = current_setting('app.tenant_id', true)::uuid
  )
);

CREATE POLICY dedup_tenant_isolation
ON operation_deduplication
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE POLICY outbox_tenant_isolation
ON outbox_events
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

-- Composite Operational Indexes
CREATE INDEX IF NOT EXISTS tasks_tenant_status_created_idx
ON tasks (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS runs_tenant_status_created_idx
ON runs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS runs_worker_lease_idx
ON runs (worker_id, worker_lease_expires_at)
WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS steps_tenant_run_sequence_idx
ON steps (tenant_id, run_id, sequence);

CREATE INDEX IF NOT EXISTS worker_leases_expiry_idx
ON worker_leases (expires_at);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
ON outbox_events (published_at, created_at)
WHERE published_at IS NULL;
