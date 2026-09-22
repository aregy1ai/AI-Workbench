/**
 * AI Workbench - Tool Execution & Gateway Contracts
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { RiskLevel } from "./run";
export type { RiskLevel };
export type { SecretLease } from "../../secrets/src/lease";

export interface ToolCall {
  id: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  toolName: string;
  toolVersion: string;
  status: string;
  idempotencyKey: string;
  requestHash: string;
  resultHash?: string;
  policyDecisionId?: string;
  approvalId?: string;
  secretLeaseId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ExecutionContext {
  issuer?: string;
  keyId?: string;
  issuedAt: string | Date;
  expiresAt: string | Date;
  nonce?: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  actorId: string;
  riskLevel: RiskLevel;
  action?: string;
  requestedAction?: string;
  cancellationEpoch?: number;
  policyVersion?: string;
  signature?: string;
  token?: string;
}

export interface ToolRequest {
  toolName: string;
  toolVersion: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;

  actor: {
    type: "user" | "agent" | "worker" | "service";
    id: string;
  };

  input: unknown;
  requestedCapabilities: string[];
  idempotencyKey: string;
  contextToken: string;
}

export type ToolResponse =
  | {
      status: "succeeded";
      result: unknown;
      artifactIds: string[];
      auditEventId: string;
      retryable: false;
    }
  | {
      status: "requires_approval";
      approvalId: string;
      auditEventId: string;
      retryable: false;
    }
  | {
      status: "rejected";
      code: string;
      reason: string;
      auditEventId: string;
      retryable: false;
    }
  | {
      status: "failed";
      code: string;
      auditEventId: string;
      retryable: boolean;
    };

export interface ToolDefinition {
  name: string;
  version: string;
  requiredPermission: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  allowedResourceTypes: string[];
  networkRequirements: string[];
  secretRequirements: string[];
  maximumRuntimeMs: number;
  maximumCost: number;
  approvalRequired: boolean;
  idempotencyStrategy:
    | "read"
    | "branch-name"
    | "patch-hash"
    | "run-base-head"
    | "custom";
}
