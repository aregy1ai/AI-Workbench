/**
 * AI Workbench - Audit Ledger Contracts
 * Sprint 4: Policy Engine & Tool Gateway
 */

export interface AuditEventInput {
  tenantId: string;
  workspaceId?: string;
  runId?: string;
  stepId?: string;
  eventType: string;
  actorType: "user" | "agent" | "worker" | "service";
  actorId: string;
  policyVersion?: string;
  sensitivity?: "public" | "internal" | "confidential" | "restricted";
  payload: Record<string, unknown>;
}

export interface AuditEventRecord {
  id: string;
  tenantId: string;
  workspaceId?: string;
  runId?: string;
  stepId?: string;
  eventType: string;
  actorType: string;
  actorId: string;
  sequenceNumber: number;
  previousEventHash: string | null;
  payloadHash: string;
  policyVersion?: string;
  sensitivity: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
