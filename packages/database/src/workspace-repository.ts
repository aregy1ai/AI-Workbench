/**
 * AI Workbench - Workspace Repository with Tenant Scoping & RLS
 * Sprint 1: Database Persistence
 */

import { RequestContext } from "../../contracts/src/context";
import { assertContext } from "../../auth/src/context";

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

export interface DatabasePool {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export class WorkspaceRepository {
  private inMemoryStore: Workspace[] = [];

  constructor(private readonly db?: DatabasePool) {}

  /**
   * Lists all workspaces for the scoped tenant in context
   */
  listSync(context: RequestContext): Workspace[] {
    assertContext(context);

    // In-memory or simulated database with RLS semantics
    return this.inMemoryStore
      .filter((w) => w.tenantId === context.tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async list(context: RequestContext): Promise<Workspace[]> {
    return this.listSync(context);
  }

  /**
   * Creates a new workspace scoped strictly to context.tenantId
   */
  createSync(context: RequestContext, name: string): Workspace {
    assertContext(context);

    const workspace: Workspace = {
      id: `ws_${Math.random().toString(36).substring(2, 9)}`,
      tenantId: context.tenantId,
      name,
      createdAt: new Date(),
    };

    this.inMemoryStore.push(workspace);
    return workspace;
  }

  async create(context: RequestContext, name: string): Promise<Workspace> {
    return this.createSync(context, name);
  }

  /**
   * Attempt to create workspace for a specified tenantId.
   * If targetTenantId !== context.tenantId, RLS / authorization asserts failure!
   */
  createForTenantSync(
    context: RequestContext,
    targetTenantId: string,
    name: string
  ): Workspace {
    assertContext(context);

    if (context.tenantId !== targetTenantId) {
      throw new Error(`TENANT_SCOPE_INVALID: Context tenant ${context.tenantId} cannot write to ${targetTenantId}`);
    }

    return this.createSync(context, name);
  }

  async createForTenant(
    context: RequestContext,
    targetTenantId: string,
    name: string
  ): Promise<Workspace> {
    return this.createForTenantSync(context, targetTenantId, name);
  }
}

export const workspaceRepository = new WorkspaceRepository();

