/**
 * AI Workbench - Signed Execution Context Contracts
 * Sprint 4: Policy Engine & Tool Gateway
 */

export interface ExecutionContextPayload {
  issuer: string;
  keyId: string;
  issuedAt: number; // Unix timestamp in seconds
  expiresAt: number; // Unix timestamp in seconds
  nonce: string;

  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  actorId: string;
  actorType?: "user" | "agent" | "worker" | "service";

  requestedAction: string;
  riskLevel: string;
  policyVersion: string;
  cancellationEpoch: number;
}

export interface SignedExecutionContext {
  payload: ExecutionContextPayload;
  signature: string;
}
