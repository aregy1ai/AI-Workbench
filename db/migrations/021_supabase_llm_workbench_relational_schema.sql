-- ==============================================================================
-- Migration: 021_supabase_llm_workbench_relational_schema.sql
-- Production Relational Schema for Supabase & @llm-workbench/runtime
-- Full Multi-Tenant Normalization: runs, run_steps, run_artifacts, run_rules, 
-- run_traces, run_gates, and analytical aggregates.
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: runs (Core Control Plane Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  workflow_id text NOT NULL,
  workflow_version integer NOT NULL DEFAULT 1,
  workflow_snapshot jsonb NOT NULL,
  status text NOT NULL CHECK (
    status IN ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled')
  ),
  subject_user_id text NOT NULL,
  subject_metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  bundle_hash text,
  total_tokens integer DEFAULT 0,
  total_cost_usd numeric(12, 6) DEFAULT 0.000000,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Table: run_steps (Individual Workflow Steps Execution)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  title text,
  status text NOT NULL CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'blocked')
  ),
  gate_policy text NOT NULL DEFAULT 'AUTO' CHECK (
    gate_policy IN ('AUTO', 'PAUSE_BEFORE', 'PAUSE_AFTER')
  ),
  attempt_count integer NOT NULL DEFAULT 1,
  error_message text,
  error_code text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_id, step_id)
);

-- ------------------------------------------------------------------------------
-- 3. Table: run_artifacts (Agent Outputs, Decisions, Embeddings, Contracts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_id text,
  artifact_key text NOT NULL,
  type_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  checksum_sha256 text,
  is_redacted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_id, artifact_key, version)
);

-- ------------------------------------------------------------------------------
-- 4. Table: run_rules (Guardrails, Budgets, Latency SLAs, Compliance Checks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_set_id text NOT NULL,
  rule_id text NOT NULL,
  rule_schema_id text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  label text,
  payload jsonb NOT NULL,
  evaluation_status text DEFAULT 'passed' CHECK (
    evaluation_status IN ('passed', 'violated', 'warning', 'skipped')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. Table: run_gates (Human-in-the-Loop Approval & Verification Gates)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  gate_position text NOT NULL CHECK (
    gate_position IN ('before', 'after', 'checkpoint')
  ),
  status text NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'timed_out', 'cancelled')
  ),
  decision text CHECK (decision IN ('approved', 'rejected', 'edited')),
  required_role text DEFAULT 'admin',
  reviewer_id text,
  reviewer_notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. Table: run_traces (Append-Only Event Stream, Token Telemetry, Cryptographic Hash)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_traces (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seq_no integer NOT NULL,
  event_type text NOT NULL,
  step_id text,
  model_id text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  latency_ms integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0.000000,
  payload jsonb NOT NULL,
  event_hash text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. High-Performance Multi-Tenant Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_runs_tenant_status 
  ON runs(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_tenant_workflow 
  ON runs(tenant_id, workflow_id);

CREATE INDEX IF NOT EXISTS idx_run_steps_composite 
  ON run_steps(tenant_id, run_id, step_id);

CREATE INDEX IF NOT EXISTS idx_run_artifacts_lookup 
  ON run_artifacts(tenant_id, run_id, artifact_key);

CREATE INDEX IF NOT EXISTS idx_run_artifacts_type 
  ON run_artifacts(tenant_id, type_id);

CREATE INDEX IF NOT EXISTS idx_run_gates_pending 
  ON run_gates(tenant_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_run_traces_run_seq 
  ON run_traces(tenant_id, run_id, seq_no ASC);

-- GIN Indexes for fast JSONB querying inside payloads and metadata
CREATE INDEX IF NOT EXISTS idx_runs_metadata_gin 
  ON runs USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_run_artifacts_data_gin 
  ON run_artifacts USING gin (data);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;

ALTER TABLE run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_steps FORCE ROW LEVEL SECURITY;

ALTER TABLE run_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_artifacts FORCE ROW LEVEL SECURITY;

ALTER TABLE run_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE run_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_gates FORCE ROW LEVEL SECURITY;

ALTER TABLE run_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_traces FORCE ROW LEVEL SECURITY;

-- Dynamic Tenant Isolation Policies
CREATE POLICY p_runs_tenant_isolation ON runs
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY p_run_steps_tenant_isolation ON run_steps
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY p_run_artifacts_tenant_isolation ON run_artifacts
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY p_run_rules_tenant_isolation ON run_rules
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY p_run_gates_tenant_isolation ON run_gates
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY p_run_traces_tenant_isolation ON run_traces
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ------------------------------------------------------------------------------
-- 9. Analytical Aggregation Views for Telemetry & Cost Dashboards
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenant_workbench_usage AS
SELECT
  r.tenant_id,
  count(DISTINCT r.id) AS total_runs,
  count(DISTINCT r.id) FILTER (WHERE r.status = 'active') AS active_runs,
  count(DISTINCT r.id) FILTER (WHERE r.status = 'completed') AS completed_runs,
  count(DISTINCT r.id) FILTER (WHERE r.status = 'failed') AS failed_runs,
  count(DISTINCT g.id) FILTER (WHERE g.status = 'pending') AS pending_human_gates,
  coalesce(sum(t.cost_usd), 0) AS total_inference_cost_usd,
  coalesce(sum(t.prompt_tokens + t.completion_tokens), 0) AS total_tokens_processed
FROM runs r
LEFT JOIN run_gates g ON r.id = g.run_id AND r.tenant_id = g.tenant_id
LEFT JOIN run_traces t ON r.id = t.run_id AND r.tenant_id = t.tenant_id
GROUP BY r.tenant_id;
