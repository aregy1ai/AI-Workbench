import React, { useState } from "react";
import {
  FileCode,
  FolderTree,
  Copy,
  Check,
} from "lucide-react";

interface CodeFile {
  path: string;
  category: "Configuration" | "Migrations & RLS" | "Contracts" | "Auth & Authz" | "API & Middlewares" | "Database & Tests" | "Run Engine & Queues" | "Policy & Tool Gateway";
  description: string;
  content: string;
}

const FILES_DATA: CodeFile[] = [
  {
    path: "pnpm-workspace.yaml",
    category: "Configuration",
    description: "Monorepo workspace mapping apps, packages, and tests.",
    content: `packages:
  - "apps/*"
  - "packages/*"
  - "tests"`,
  },
  {
    path: "tsconfig.base.json",
    category: "Configuration",
    description: "Strict TypeScript compiler options for all packages.",
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}`,
  },
  {
    path: "docker-compose.yml",
    category: "Configuration",
    description: "Services for PostgreSQL 17, Redis 7-alpine, and MinIO object storage.",
    content: `services:
  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: workbench
      POSTGRES_PASSWORD: workbench
      POSTGRES_DB: workbench
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U workbench -d workbench"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data`,
  },
  {
    path: ".github/workflows/ci.yml",
    category: "Configuration",
    description: "Automated CI checks for linting, typechecking, tests, and tenant security.",
    content: `name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: workbench
          POSTGRES_PASSWORD: workbench
          POSTGRES_DB: workbench_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:security`,
  },
  {
    path: "db/migrations/001_extensions.sql",
    category: "Migrations & RLS",
    description: "Installs pgcrypto for UUID and cryptographic hashing.",
    content: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
  },
  {
    path: "db/migrations/002_identity.sql",
    category: "Migrations & RLS",
    description: "Tenants, users, and memberships tables with role constraints.",
    content: `CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);`,
  },
  {
    path: "db/migrations/003_workspaces.sql",
    category: "Migrations & RLS",
    description: "Workspaces and repositories tables with tenant FK scoping.",
    content: `CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github')),
  external_id text NOT NULL,
  full_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);`,
  },
  {
    path: "db/migrations/004_rls.sql",
    category: "Migrations & RLS",
    description: "FORCE ROW LEVEL SECURITY policies isolating tenants in PostgreSQL.",
    content: `ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  USING (id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY membership_isolation ON memberships
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY workspace_isolation ON workspaces
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY repository_isolation ON repositories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);`,
  },
  {
    path: "db/migrations/005_indexes.sql",
    category: "Migrations & RLS",
    description: "Composite and foreign key indexes for performant tenant queries.",
    content: `CREATE INDEX memberships_user_idx
ON memberships (user_id);

CREATE INDEX workspaces_tenant_created_idx
ON workspaces (tenant_id, created_at DESC);

CREATE INDEX repositories_tenant_workspace_idx
ON repositories (tenant_id, workspace_id);

CREATE UNIQUE INDEX repositories_external_identity_idx
ON repositories (tenant_id, provider, external_id);`,
  },
  {
    path: "packages/contracts/src/context.ts",
    category: "Contracts",
    description: "Unified RequestContext contract carrying tenantId, actorId, and roles.",
    content: `export interface RequestContext {
  requestId: string;
  tenantId: string;
  actorId: string;
  actorType: "user" | "agent" | "worker" | "service";
  roles: string[];
  issuedAt: Date;
  expiresAt: Date;
}`,
  },
  {
    path: "packages/auth/src/context.ts",
    category: "Auth & Authz",
    description: "assertContext validation & cryptographic ContextSigner with Nonce replay defense.",
    content: `export function assertContext(context: RequestContext): void {
  if (!context.requestId) throw new Error("AUTH_REQUIRED");
  if (!context.tenantId) throw new Error("TENANT_SCOPE_INVALID");
  if (!context.actorId) throw new Error("AUTH_REQUIRED");
  if (context.expiresAt.getTime() <= Date.now()) throw new Error("AUTH_REQUIRED");
}`,
  },
  {
    path: "packages/authorization/src/authorize.ts",
    category: "Auth & Authz",
    description: "RBAC role permissions matrix, hasPermission, and assertPermission.",
    content: `export const rolePermissions: Record<string, Permission[]> = {
  owner: ["tenant:read", "workspace:read", "workspace:write", "repository:read", "repository:write", "run:create", "run:cancel", "approval:decide"],
  admin: ["tenant:read", "workspace:read", "workspace:write", "repository:read", "repository:write", "run:create", "run:cancel", "approval:decide"],
  developer: ["workspace:read", "workspace:write", "repository:read", "repository:write", "run:create", "run:cancel"],
  viewer: ["workspace:read", "repository:read"],
};

export function assertPermission(roles: string[], permission: Permission): void {
  if (!hasPermission(roles, permission)) throw new Error("FORBIDDEN");
}`,
  },
  {
    path: "packages/database/src/workspace-repository.ts",
    category: "Database & Tests",
    description: "Workspace repository enforcing tenant context isolation on list and create.",
    content: `export class WorkspaceRepository {
  async list(context: RequestContext): Promise<Workspace[]> {
    assertContext(context);
    return this.inMemoryStore.filter((w) => w.tenantId === context.tenantId);
  }

  async create(context: RequestContext, name: string): Promise<Workspace> {
    assertContext(context);
    const workspace: Workspace = { id: \`ws_\${Math.random().toString(36).substring(2, 9)}\`, tenantId: context.tenantId, name, createdAt: new Date() };
    this.inMemoryStore.push(workspace);
    return workspace;
  }
}`,
  },
  {
    path: "apps/api/src/app.ts",
    category: "API & Middlewares",
    description: "Express application wiring request ID, auth context, error handler, and routes.",
    content: `export function createApiApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/health", healthRouter);
  app.use(authContextMiddleware);
  app.use(workspacesRouter);
  app.use(repositoriesRouter);
  app.use(errorHandler);
  return app;
}`,
  },
  {
    path: "apps/api/src/routes/workspaces.ts",
    category: "API & Middlewares",
    description: "GET /v1/workspaces & POST /v1/workspaces with assertPermission and RLS context.",
    content: `workspacesRouter.get("/v1/workspaces", async (req, res, next) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "workspace:read");
    const workspaces = await workspaceRepository.list(context);
    res.json({ data: workspaces, requestId: context.requestId });
  } catch (error) { next(error); }
});`,
  },
  {
    path: "tests/security/tenant-isolation.test.ts",
    category: "Database & Tests",
    description: "Security test suite verifying RLS isolation, cross-tenant denial, and replay defense.",
    content: `describe("tenant isolation", () => {
  it("does not return another tenant workspaces", async () => { ... });
  it("rejects inserts into another tenant", async () => { ... });
  it("fails closed without tenant context", async () => { ... });
});`,
  },
  {
    path: "db/migrations/006_run_engine.sql",
    category: "Migrations & RLS",
    description: "Tables for tasks, runs, steps, worker_leases, and RLS policies.",
    content: `CREATE TABLE tasks ( ... );
CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('created','queued','running','waiting_approval','cancellation_requested','cancelling','succeeded','failed','cancelled','cancel_failed')),
  version bigint NOT NULL DEFAULT 0,
  cancellation_epoch bigint NOT NULL DEFAULT 0,
  ...
);
CREATE TABLE steps ( ... );
CREATE TABLE worker_leases ( run_id uuid PRIMARY KEY, worker_id text, expires_at timestamptz ... );`,
  },
  {
    path: "packages/runs/src/state-machine.ts",
    category: "Run Engine & Queues",
    description: "Strict Run state machine transitions, assertTransition, and optimistic version checks.",
    content: `export const transitions: Record<RunStatus, readonly RunStatus[]> = {
  created: ["queued", "failed"],
  queued: ["running", "cancellation_requested", "failed"],
  running: ["waiting_approval", "succeeded", "failed", "cancellation_requested"],
  waiting_approval: ["running", "failed", "cancellation_requested"],
  cancellation_requested: ["cancelling", "cancel_failed"],
  cancelling: ["cancelled", "cancel_failed"],
  succeeded: [], failed: [], cancelled: [], cancel_failed: []
};`,
  },
  {
    path: "packages/runs/src/run-service.ts",
    category: "Run Engine & Queues",
    description: "Idempotent Run creation, operation deduplication, cancellation epoch bumping, and deep cancellation.",
    content: `export class RunService {
  async create(input: CreateRunInput, context: RequestContext): Promise<Run> {
    const idempotencyKey = \`run:create:\${input.clientRequestId}\`;
    if (this.deduplicationStore.has(idempotencyKey)) return this.deduplicationStore.get(idempotencyKey)!;
    // creates run, outbox event & enqueues to Redis queue
  }
}`,
  },
  {
    path: "packages/worker/src/lease-manager.ts",
    category: "Run Engine & Queues",
    description: "Worker claim with 30s lease, 10s heartbeat extension, and crash recovery scanner.",
    content: `export class WorkerLeaseManager {
  async claimRun(runId: string, workerId: string): Promise<WorkerLease> { ... }
  async heartbeat(lease: WorkerLease): Promise<void> { ... }
  async recoverExpiredLeases(): Promise<string[]> {
    // sweeps expired leases, marks status 'queued', bumps version, and re-enqueues
  }
}`,
  },
  {
    path: "tests/engine/run-engine.test.ts",
    category: "Database & Tests",
    description: "Sprint 2 test suite verifying state machine, version locking, crash recovery, and cancellation race.",
    content: `describe("run engine", () => {
  it("rejects stale worker update", async () => { ... });
  it("returns the same run for duplicate request", async () => { ... });
  it("requeues a run after worker lease expiry", async () => { ... });
  it("does not start a new step after cancellation", async () => { ... });
  it("does not allow tenant B to cancel tenant A run", async () => { ... });
});`,
  },
  {
    path: "packages/tools/src/gateway.ts",
    category: "Policy & Tool Gateway",
    description: "Sprint 4 central Tool Gateway: enforces the 17-step pipeline from signed context to revocation.",
    content: `export class ToolGateway {
  public async execute(request: ToolRequest): Promise<ToolResponse> {
    // 1. Verify Signed Execution Context
    const context = await executionContextSigner.verify(request.contextToken);
    // 2. Validate Scopes Match (tenant, workspace, run, step, actor)
    assertRequestMatchesContext(request, context);
    // 3. Resolve Tool & Schema Validation
    const tool = toolRegistry.resolve(request.toolName, request.toolVersion);
    // 4. Scoped Run & Cancellation Epoch Check
    // 5. Idempotency Check
    // 6. Policy Evaluation (allow / deny / approval_required)
    // 7. Budget Reservation
    // 8. Ephemeral Secret Lease Issuance
    // 9. Tool Execution & Output Redaction
    // 10. Audit Event & Cost Settlement
    // 11. Guaranteed Secret Revocation in finally block
  }
}`,
  },
  {
    path: "packages/policy/src/engine.ts",
    category: "Policy & Tool Gateway",
    description: "Sprint 4 Policy Engine evaluating access rules, human review triggers, and risk levels.",
    content: `export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  if (input.runStatus !== "running") return deny("RUN_NOT_EXECUTABLE");
  if (input.context.riskLevel !== input.tool.riskLevel) return deny("RISK_CONTEXT_MISMATCH");
  if (input.tool.name === "github.modify_workflow") return approval("WORKFLOW_MODIFICATION");
  if (input.tool.name === "github.merge_main") return approval("MAIN_MERGE");
  return allow("DEFAULT_ALLOW");
}`,
  },
  {
    path: "packages/security/src/context-signer.ts",
    category: "Policy & Tool Gateway",
    description: "Signed execution contexts with short-lived TTL and atomic nonce replay prevention.",
    content: `export class ExecutionContextSigner {
  public async create(input: Omit<ExecutionContextPayload, "issuedAt" | "expiresAt" | "nonce">): Promise<string> {
    const payload = { ...input, issuedAt: now, expiresAt: now + 300, nonce: randomUUID() };
    await nonceStore.reserve(payload.nonce, payload.expiresAt);
    return encodeBase64Url({ payload, signature: sign(payload) });
  }

  public async verify(token: string): Promise<ExecutionContextPayload> {
    const decoded = decodeBase64Url(token);
    verifySignature(decoded);
    await nonceStore.consume(decoded.payload.nonce); // Replay defense!
    return decoded.payload;
  }
}`,
  },
  {
    path: "packages/secrets/src/broker.ts",
    category: "Policy & Tool Gateway",
    description: "Secret Broker issuing scoped, short-lived tokens and ensuring immediate revocation.",
    content: `export class SecretBroker {
  public async issue(request: ToolRequest, tool: ToolDefinition): Promise<SecretLease> {
    const ttlMs = Math.min(10 * 60_000, tool.maximumRuntimeMs + 60_000);
    return { id: leaseId, expiresAt: new Date(Date.now() + ttlMs), status: "active" };
  }

  public async revoke(leaseId: string): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (lease) lease.status = "revoked";
  }
}`,
  },
  {
    path: "packages/audit/src/redaction.ts",
    category: "Policy & Tool Gateway",
    description: "Automatic redaction of tokens, keys, passwords, and private certificates before audit.",
    content: `export function redact(value: unknown): any {
  // Masks GitHub tokens (ghp_*), OpenAI keys (sk-*), Bearer tokens, private keys, and passwords
}`,
  },
  {
    path: "tests/security/tool-gateway.test.ts",
    category: "Policy & Tool Gateway",
    description: "Sprint 4 Security Test Suite: covers Replay Attacks, Expired Contexts, Wrong Tenant, and Idempotency.",
    content: `describe("Sprint 4 Tool Gateway & Policy Security Suite", () => {
  it("rejects reused execution nonce", ...);
  it("rejects expired context", ...);
  it("rejects tenant mismatch", ...);
  it("denies workflow modification without approval", ...);
  it("revokes lease after tool completion", ...);
  it("does not execute after run cancellation", ...);
  it("does not create two branches (idempotency)", ...);
});`,
  },
];

export const CodeExplorerTab: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(FILES_DATA[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase font-semibold text-purple-400 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
            Monorepo Architecture
          </span>
          <span className="text-xs text-slate-400">Sprint 1 Full File Blueprint</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight mt-1">
          Codebase Blueprint & Sprint 1 File Inspector
        </h2>
        <p className="text-xs text-slate-400 max-w-3xl mt-1">
          Browse the complete collection of foundational files generated for Sprint 1: monorepo configs, database migrations (001-005), RLS policies, RequestContext, auth assertions, authorization matrix, workspace repository, API routers, and security tests.
        </p>
      </div>

      {/* Main Grid: File List (4 cols) & Code Viewer (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: File Tree List */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2 mb-3">
            <FolderTree className="w-4 h-4 text-purple-400" />
            <span>Sprint 1 Package Files ({FILES_DATA.length})</span>
          </h3>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
            {FILES_DATA.map((file) => {
              const isSelected = file.path === selectedFile.path;
              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? "bg-slate-800 border-purple-500 text-white shadow-sm"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center space-x-2 font-mono text-[11px] truncate">
                    <FileCode
                      className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-purple-400" : "text-slate-500"}`}
                    />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pl-5">
                    <span>{file.category}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Code Inspector */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-mono font-bold text-white flex items-center space-x-2">
                <span>{selectedFile.path}</span>
                <span className="text-[10px] font-sans font-normal px-2 py-0.5 rounded bg-slate-800 text-purple-300">
                  {selectedFile.category}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">{selectedFile.description}</p>
            </div>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Code"}</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-[540px] leading-relaxed scrollbar-thin">
            <pre>{selectedFile.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
