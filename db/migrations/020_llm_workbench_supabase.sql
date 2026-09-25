-- ==============================================================================
-- Migration 020_llm_workbench_supabase.sql
-- LLM Workbench Multi-Tenant Persistence & Supabase Storage Adapter
-- Control Plane Schema: Runs, Artifacts, Rules, Human Gates, and Audit Traces
-- ==============================================================================

-- 1. Main Runs Table (Holds LLM Workbench Runs & Full State Snapshots)
CREATE TABLE IF NOT EXISTS llm_workbench_runs (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  workflow_id text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('active', 'paused', 'completed', 'failed', 'cancelled')
  ),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  run_state jsonb NOT NULL,
  bundle_hash text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Granular Artifacts Table (Enables fast querying and indexing of agent artifacts)
CREATE TABLE IF NOT EXISTS llm_workbench_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES llm_workbench_runs(id) ON DELETE CASCADE,
  artifact_key text NOT NULL,
  type_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, run_id, artifact_key, version)
);

-- 3. Granular Rules & Guardrails Table
CREATE TABLE IF NOT EXISTS llm_workbench_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES llm_workbench_runs(id) ON DELETE CASCADE,
  rule_set_id text NOT NULL,
  rule_id text NOT NULL,
  schema_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  order_idx integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Human-Review Gates Table (Tracks pause points, approvals, and decisions)
CREATE TABLE IF NOT EXISTS llm_workbench_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES llm_workbench_runs(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  gate_type text NOT NULL CHECK (gate_type IN ('PAUSE_BEFORE', 'PAUSE_AFTER', 'CHECKPOINT')),
  status text NOT NULL CHECK (status IN ('requested', 'resolved', 'timed_out', 'cancelled')),
  decision text CHECK (decision IN ('approved', 'rejected', 'edited')),
  reviewer_id text,
  reviewer_role text,
  reviewer_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- 5. Append-Only Traces & Event Ledger (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS llm_workbench_traces (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES llm_workbench_runs(id) ON DELETE CASCADE,
  seq_no integer NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Indexes for High-Throughput Multi-Tenant Queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_llm_runs_tenant_status 
  ON llm_workbench_runs(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_runs_workflow 
  ON llm_workbench_runs(tenant_id, workflow_id);

CREATE INDEX IF NOT EXISTS idx_llm_artifacts_lookup 
  ON llm_workbench_artifacts(tenant_id, run_id, artifact_key);

CREATE INDEX IF NOT EXISTS idx_llm_gates_pending 
  ON llm_workbench_gates(tenant_id, status) 
  WHERE status = 'requested';

CREATE INDEX IF NOT EXISTS idx_llm_traces_ordered 
  ON llm_workbench_traces(tenant_id, run_id, seq_no ASC);

-- ==============================================================================
-- Row Level Security (RLS) Enforcement - Zero Cross-Tenant Leakage
-- ==============================================================================
ALTER TABLE llm_workbench_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_workbench_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE llm_workbench_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_workbench_artifacts FORCE ROW LEVEL SECURITY;

ALTER TABLE llm_workbench_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_workbench_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE llm_workbench_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_workbench_gates FORCE ROW LEVEL SECURITY;

ALTER TABLE llm_workbench_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_workbench_traces FORCE ROW LEVEL SECURITY;

-- 1. Runs Tenant Isolation Policy
CREATE POLICY llm_runs_tenant_isolation ON llm_workbench_runs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 2. Artifacts Tenant Isolation Policy
CREATE POLICY llm_artifacts_tenant_isolation ON llm_workbench_artifacts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 3. Rules Tenant Isolation Policy
CREATE POLICY llm_rules_tenant_isolation ON llm_workbench_rules
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 4. Gates Tenant Isolation Policy
CREATE POLICY llm_gates_tenant_isolation ON llm_workbench_gates
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 5. Traces Tenant Isolation Policy
CREATE POLICY llm_traces_tenant_isolation ON llm_workbench_traces
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ==============================================================================
-- Security Helper Function: set_tenant_context
-- ==============================================================================
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id uuid, p_user_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.actor_id', p_user_id, true);
  END IF;
END;
$$;
