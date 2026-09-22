/**
 * AI Workbench - Unified Request Context Contract
 * Sprint 1: Identity, Actor Scoping & RBAC
 */

export interface RequestContext {
  requestId: string;
  tenantId: string;
  actorId: string;
  actorType: "user" | "agent" | "worker" | "service";
  roles: string[];
  issuedAt: Date;
  expiresAt: Date;
}
