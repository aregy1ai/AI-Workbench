/**
 * AI Workbench - Role-Based Authorization & Tenant Scoping
 * Phase: Sprint 1 Authorization Layer
 */

import { RequestContext } from "../../database/src/client";
import { AppError, failure, success, Result } from "../../contracts/src/errors";

export type Role = "owner" | "admin" | "developer" | "auditor";

export type Permission =
  | "tenant:read"
  | "workspace:read"
  | "workspace:write"
  | "workspace:modify"
  | "repository:read"
  | "repository:write"
  | "run:create"
  | "run:cancel"
  | "run:resume"
  | "run:view"
  | "approval:review"
  | "approval:decide"
  | "audit:read"
  | "budget:modify";

export const rolePermissions: Record<string, Permission[]> = {
  owner: [
    "tenant:read",
    "workspace:read",
    "workspace:write",
    "workspace:modify",
    "repository:read",
    "repository:write",
    "run:create",
    "run:cancel",
    "run:resume",
    "run:view",
    "approval:review",
    "approval:decide",
    "audit:read",
    "budget:modify",
  ],
  admin: [
    "tenant:read",
    "workspace:read",
    "workspace:write",
    "workspace:modify",
    "repository:read",
    "repository:write",
    "run:create",
    "run:cancel",
    "run:resume",
    "run:view",
    "approval:review",
    "approval:decide",
    "audit:read",
  ],
  developer: [
    "workspace:read",
    "workspace:write",
    "repository:read",
    "repository:write",
    "run:create",
    "run:cancel",
    "run:resume",
    "run:view",
  ],
  viewer: [
    "workspace:read",
    "repository:read",
    "run:view",
  ],
  auditor: [
    "workspace:read",
    "repository:read",
    "run:view",
    "audit:read",
  ],
};

export function hasPermission(
  roles: string[],
  permission: Permission,
): boolean {
  return roles.some((role) =>
    rolePermissions[role]?.includes(permission),
  );
}

export function assertPermission(
  roles: string[],
  permission: Permission,
): void {
  if (!hasPermission(roles, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export class AuthorizationService {
  /**
   * Evaluates if a role has the requested permission
   */
  public hasPermission(role: Role | string, permission: Permission): boolean {
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Asserts permission and returns a structured Result
   */
  public assert(
    context: RequestContext,
    role: Role,
    permission: Permission
  ): Result<boolean> {
    if (!context.tenantId) {
      return failure("TENANT_SCOPE_INVALID", "Missing tenant id in request context");
    }

    if (!this.hasPermission(role, permission)) {
      return failure(
        "FORBIDDEN",
        `Actor ${context.actorId} with role '${role}' lacks permission '${permission}'`
      );
    }

    return success(true);
  }

  /**
   * Verifies that the target resource belongs strictly to the tenant in context
   */
  public assertTenantScope(
    contextTenantId: string,
    resourceTenantId: string
  ): Result<boolean> {
    if (contextTenantId !== resourceTenantId) {
      return failure(
        "TENANT_SCOPE_INVALID",
        `Cross-tenant access prohibited: context=${contextTenantId}, resource=${resourceTenantId}`
      );
    }
    return success(true);
  }
}

export const authorization = new AuthorizationService();
