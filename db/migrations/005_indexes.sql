CREATE INDEX memberships_user_idx
ON memberships (user_id);

CREATE INDEX workspaces_tenant_created_idx
ON workspaces (tenant_id, created_at DESC);

CREATE INDEX repositories_tenant_workspace_idx
ON repositories (tenant_id, workspace_id);

CREATE UNIQUE INDEX repositories_external_identity_idx
ON repositories (tenant_id, provider, external_id);
