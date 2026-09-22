-- Migration 002_rls.sql
-- AI Workbench Row Level Security (RLS) & Multi-Tenant Enforcement
-- Phase: Sprint 1 Security Hardening

-- 1. Enable and FORCE RLS on all tenant-sensitive tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories FORCE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;

ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps FORCE ROW LEVEL SECURITY;

ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls FORCE ROW LEVEL SECURITY;

ALTER TABLE operation_deduplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_deduplication FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

ALTER TABLE secret_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_leases FORCE ROW LEVEL SECURITY;

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records FORCE ROW LEVEL SECURITY;

-- 2. Define Tenant Isolation Policies using session variable 'app.tenant_id'

-- Workspaces Policy
CREATE POLICY workspaces_tenant_isolation ON workspaces
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Repositories Policy
CREATE POLICY repositories_tenant_isolation ON repositories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Tasks Policy
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Runs Policy
CREATE POLICY runs_tenant_isolation ON runs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Steps Policy
CREATE POLICY steps_tenant_isolation ON steps
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Tool Calls Policy
CREATE POLICY tool_calls_tenant_isolation ON tool_calls
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Deduplication Policy
CREATE POLICY deduplication_tenant_isolation ON operation_deduplication
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Outbox Events Policy
CREATE POLICY outbox_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Secret Leases Policy
CREATE POLICY secret_leases_tenant_isolation ON secret_leases
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Approvals Policy
CREATE POLICY approvals_tenant_isolation ON approvals
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Audit Events Policy (Strict Read/Append Tenant Isolation)
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Cost Records Policy
CREATE POLICY cost_records_tenant_isolation ON cost_records
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
