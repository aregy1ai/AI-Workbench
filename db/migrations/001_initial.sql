-- Migration 001_initial.sql
-- AI Workbench Control Plane Core Schema
-- Phase: Sprint 1 Schema Definition

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants: Root isolation boundary
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users: Human operators and system accounts
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Memberships: Multi-tenant role binding
CREATE TABLE IF NOT EXISTS memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'owner', 'admin', 'developer', 'auditor'
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Workspaces: Tenant sub-grouping
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Repositories: Connected source code repos
CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'github', 'gitlab'
  external_id text NOT NULL,
  full_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

-- Tasks: High level software engineering goals
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  base_branch text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  risk_level text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Runs: Single agentic execution lifecycle instance
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'created',
  cancellation_epoch bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 0,
  runtime_name text NOT NULL,
  runtime_version text NOT NULL,
  budget_limit numeric(18, 8) NOT NULL,
  budget_reserved numeric(18, 8) NOT NULL DEFAULT 0,
  budget_consumed numeric(18, 8) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  failure_code text
);

-- Steps: Discrete sequence of thought, tool call, or approval
CREATE TABLE IF NOT EXISTS steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 0,
  input_hash text NOT NULL,
  output_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (run_id, sequence)
);

-- Tool Calls: Guarded tool execution records
CREATE TABLE IF NOT EXISTS tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_version text NOT NULL,
  status text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result_hash text,
  policy_decision_id uuid,
  approval_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (idempotency_key)
);

-- Operation Deduplication: Idempotency locks
CREATE TABLE IF NOT EXISTS operation_deduplication (
  idempotency_key text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Outbox Events: Transactional event publishing
CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Secret Leases: Short-lived credentials issued by Secret Broker
CREATE TABLE IF NOT EXISTS secret_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  scope text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Human Approvals: Human-in-the-loop gating for High/Critical actions
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_call_id uuid REFERENCES tool_calls(id),
  action_type text NOT NULL,
  risk_level text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewer_id uuid REFERENCES users(id),
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit Events: Cryptographically hash-chained tamper-evident ledger
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid,
  step_id uuid,
  actor_id uuid NOT NULL,
  event_type text NOT NULL,
  sequence_number bigint NOT NULL,
  previous_event_hash text NOT NULL,
  payload_hash text NOT NULL,
  sensitivity text NOT NULL DEFAULT 'internal',
  metadata jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sequence_number)
);

-- Cost Records: Granular token and execution cost tracking
CREATE TABLE IF NOT EXISTS cost_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id uuid,
  category text NOT NULL, -- 'llm_tokens', 'sandbox_runtime', 'storage'
  amount numeric(18, 8) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
