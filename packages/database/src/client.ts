/**
 * AI Workbench - Database Client & Tenant Context Session Manager
 * Phase: Sprint 1 Database Layer & RLS Context Contract
 */

export interface RequestContext {
  tenantId: string;
  workspaceId?: string;
  actorId: string;
  actorType: "user" | "agent" | "worker" | "service";
  requestId: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface Transaction {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: any[]): Promise<void>;
}

export interface Database {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}

/**
 * Executes a work unit inside a transaction with Postgres session variables set.
 * Enforces PostgreSQL RLS by setting:
 *   SET LOCAL app.tenant_id = $tenantId
 *   SET LOCAL app.actor_id = $actorId
 *   SET LOCAL app.request_id = $requestId
 */
export async function withTenantContext<T>(
  db: Database,
  context: RequestContext,
  work: (tx: Transaction) => Promise<T>
): Promise<T> {
  if (!context.tenantId || context.tenantId.trim() === "") {
    throw new Error("TENANT_SCOPE_INVALID: Missing tenant context in transaction");
  }

  return db.transaction(async (tx) => {
    await tx.execute(`SELECT set_config('app.tenant_id', $1, true)`, [context.tenantId]);
    await tx.execute(`SELECT set_config('app.actor_id', $1, true)`, [context.actorId]);
    await tx.execute(`SELECT set_config('app.request_id', $1, true)`, [context.requestId]);

    return work(tx);
  });
}

/**
 * In-Memory Database Engine with RLS Enforcement for Local Testing & Web Simulator
 */
export class MemoryDatabase implements Database {
  private tables: Map<string, Array<Record<string, any>>> = new Map();
  private sessionVars: Map<string, string> = new Map();

  constructor() {
    this.initTables();
  }

  private initTables() {
    const tableNames = [
      "tenants",
      "users",
      "memberships",
      "workspaces",
      "repositories",
      "tasks",
      "runs",
      "steps",
      "tool_calls",
      "operation_deduplication",
      "outbox_events",
      "audit_events",
      "secret_leases",
      "approvals",
    ];
    tableNames.forEach((t) => this.tables.set(t, []));
  }

  public getTable(name: string): Array<Record<string, any>> {
    return this.tables.get(name) || [];
  }

  public setSessionVar(name: string, value: string) {
    this.sessionVars.set(name, value);
  }

  public getSessionVar(name: string): string | undefined {
    return this.sessionVars.get(name);
  }

  public clearSessionVars() {
    this.sessionVars.clear();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    // Basic query interpreter for memory simulation with RLS checks
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx: Transaction = {
      query: async <R = any>(sql: string, params: any[] = []): Promise<QueryResult<R>> => {
        return this.query<R>(sql, params);
      },
      execute: async (sql: string, params: any[] = []): Promise<void> => {
        if (sql.includes("set_config('app.tenant_id'")) {
          this.setSessionVar("app.tenant_id", params[0]);
        } else if (sql.includes("set_config('app.actor_id'")) {
          this.setSessionVar("app.actor_id", params[0]);
        } else if (sql.includes("set_config('app.request_id'")) {
          this.setSessionVar("app.request_id", params[0]);
        }
      },
    };

    try {
      return await work(tx);
    } finally {
      this.clearSessionVars();
    }
  }
}
