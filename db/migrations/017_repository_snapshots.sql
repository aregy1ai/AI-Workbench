-- 017_repository_snapshots.sql
-- Sprint 5: Repository Snapshots with Tenant Isolation

CREATE TABLE IF NOT EXISTS repository_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  repository_id uuid NOT NULL REFERENCES repositories(id),
  commit_sha text NOT NULL,
  object_key text NOT NULL,
  tree_hash text NOT NULL,

  status text NOT NULL
    CHECK (status IN ('available', 'refreshing', 'failed', 'expired')),

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS repository_snapshot_commit_unique
ON repository_snapshots (
  tenant_id,
  repository_id,
  commit_sha
);

ALTER TABLE repository_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY snapshot_tenant_isolation
ON repository_snapshots
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);
