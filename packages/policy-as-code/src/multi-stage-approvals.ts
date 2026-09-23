/**
 * AI Workbench - Multi-Stage Approval Workflow & Separation of Duties
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { auditLedger } from "../../audit/src/ledger";

export type ApprovalState =
  | "requested"
  | "risk_assessed"
  | "security_review"
  | "owner_review"
  | "approved"
  | "rejected"
  | "executing"
  | "verified";

export interface ApprovalRecord {
  requestId: string;
  runId: string;
  stepId: string;
  tenantId: string;
  requesterId: string;
  action: string;
  resource: string;
  requestHash: string;
  state: ApprovalState;
  approvalsCollected: {
    approverId: string;
    role: "security_admin" | "workspace_owner" | "peer_reviewer";
    approvedAt: string;
  }[];
  rejectionReason?: string;
  createdAt: string;
  expiresAt: string;
}

export class MultiStageApprovalService {
  private requests: Map<string, ApprovalRecord> = new Map();

  constructor() {
    this.seedRequests();
  }

  private seedRequests() {
    this.createApprovalRequest({
      runId: "run_prod_9011",
      stepId: "step_deploy_03",
      tenantId: "tenant_fintech_01",
      requesterId: "agent_code_crafter_v2",
      action: "github.merge_pull_request",
      resource: "repo:fintech-core:main",
    });
  }

  public createApprovalRequest(params: {
    runId: string;
    stepId: string;
    tenantId: string;
    requesterId: string;
    action: string;
    resource: string;
  }): ApprovalRecord {
    const requestId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const requestHash = `sha256_${Math.random().toString(36).substring(2, 14)}`;

    const record: ApprovalRecord = {
      requestId,
      runId: params.runId,
      stepId: params.stepId,
      tenantId: params.tenantId,
      requesterId: params.requesterId,
      action: params.action,
      resource: params.resource,
      requestHash,
      state: "requested",
      approvalsCollected: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000 * 2).toISOString(), // 2 hours
    };

    // Transition to risk_assessed immediately
    record.state = "risk_assessed";

    this.requests.set(requestId, record);

    auditLedger.record({
      tenantId: params.tenantId,
      runId: params.runId,
      eventType: "MULTI_STAGE_APPROVAL_REQUESTED",
      actorId: params.requesterId,
      actorType: "agent",
      details: { requestId, action: params.action, resource: params.resource },
    });

    return record;
  }

  /**
   * Casts an approval with strict Separation of Duties enforcement
   */
  public submitApproval(
    requestId: string,
    approverId: string,
    role: "security_admin" | "workspace_owner" | "peer_reviewer"
  ): ApprovalRecord {
    const record = this.requests.get(requestId);
    if (!record) throw new Error(`Approval request ${requestId} not found`);

    if (record.state === "approved" || record.state === "rejected") {
      throw new Error(`Approval request is already in final state '${record.state}'`);
    }

    // Rule 1: Requester cannot approve their own action (Separation of Duties)
    if (approverId === record.requesterId) {
      throw new Error("SEPARATION_OF_DUTIES_VIOLATION: Requester cannot approve their own requested action");
    }

    // Rule 2: Agent cannot approve an action
    if (approverId.startsWith("agent_")) {
      throw new Error("AGENT_APPROVAL_FORBIDDEN: Autonomous agents cannot sign off on policy approvals");
    }

    // Rule 3: No duplicate approval by the same person
    if (record.approvalsCollected.some((a) => a.approverId === approverId)) {
      throw new Error("DUPLICATE_APPROVAL: Approver has already signed this request");
    }

    record.approvalsCollected.push({
      approverId,
      role,
      approvedAt: new Date().toISOString(),
    });

    // Advance workflow state
    if (record.approvalsCollected.length === 1) {
      record.state = "security_review";
    } else if (record.approvalsCollected.length >= 2) {
      record.state = "approved"; // Dual-approval requirement fulfilled
    }

    auditLedger.record({
      tenantId: record.tenantId,
      runId: record.runId,
      eventType: "APPROVAL_STAGE_RECORDED",
      actorId: approverId,
      actorType: "user",
      details: { requestId, role, totalApprovals: record.approvalsCollected.length, state: record.state },
    });

    return record;
  }

  public rejectRequest(requestId: string, rejectorId: string, reason: string): ApprovalRecord {
    const record = this.requests.get(requestId);
    if (!record) throw new Error(`Approval request ${requestId} not found`);

    record.state = "rejected";
    record.rejectionReason = reason;

    auditLedger.record({
      tenantId: record.tenantId,
      runId: record.runId,
      eventType: "APPROVAL_REQUEST_REJECTED",
      actorId: rejectorId,
      actorType: "user",
      details: { requestId, reason },
    });

    return record;
  }

  public getRequests(): ApprovalRecord[] {
    return Array.from(this.requests.values());
  }
}

export const multiStageApprovalService = new MultiStageApprovalService();
