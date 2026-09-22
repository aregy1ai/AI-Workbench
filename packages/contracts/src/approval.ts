/**
 * AI Workbench - Human-in-the-Loop Approval Contracts
 * Sprint 4: Policy Engine & Tool Gateway
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export interface Approval {
  id: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId?: string;
  toolCallId?: string;
  approvalType: string;
  status: ApprovalStatus;
  requestedBy: string;
  decidedBy?: string;
  reason?: string;
  inputHash?: string;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
}
