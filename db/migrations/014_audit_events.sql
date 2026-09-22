-- 014_audit_events.sql
-- Cryptographic Append-Only Audit Ledger with Canonical JSON & Hash Chaining

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  step_id uuid REFERENCES steps(id) ON DELETE SET NULL,

  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,

  sequence_number bigint NOT NULL,
  previous_event_hash text,
  payload_hash text NOT NULL,
  policy_version text,
  sensitivity text NOT NULL DEFAULT 'internal',

  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, sequence_number)
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_events_tenant_isolation
ON audit_events
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_time_idx
ON audit_events (tenant_id, occurred_at DESC);
