/**
 * AI Workbench - Human-in-the-Loop Approval Service
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { Approval } from "../../contracts/src/approval";
import { ToolRequest } from "../../contracts/src/tool";
import { PolicyDecision } from "../../contracts/src/policy";
import { RequestContext } from "../../contracts/src/context";
import { assertPermission } from "../../authorization/src/authorize";
import { approvalRepository, ApprovalRepository } from "./repository";

export class ApprovalService {
  constructor(private readonly repository: ApprovalRepository = approvalRepository) {}

  public async create(
    request: ToolRequest,
    decision: Extract<PolicyDecision, { decision: "approval_required" }>,
    toolCallId?: string
  ): Promise<Approval> {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const id = `appr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const approval: Approval = {
      id,
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      runId: request.runId,
      stepId: request.stepId,
      toolCallId,
      approvalType: decision.approvalType,
      status: "pending",
      requestedBy: request.actor.id,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    return this.repository.save(approval);
  }

  public async approve(approvalId: string, user: RequestContext): Promise<Approval> {
    assertPermission(user.roles, "approval:decide");

    const approval = this.repository.get(approvalId);
    if (!approval || approval.status !== "pending") {
      throw new Error("APPROVAL_NOT_ACTIONABLE");
    }

    if (new Date(approval.expiresAt).getTime() <= Date.now()) {
      approval.status = "expired";
      this.repository.save(approval);
      throw new Error("APPROVAL_EXPIRED");
    }

    if (user.tenantId !== approval.tenantId) {
      throw new Error("TENANT_SCOPE_INVALID");
    }

    const updated: Approval = {
      ...approval,
      status: "approved",
      decidedBy: user.actorId,
      decidedAt: new Date().toISOString(),
    };

    return this.repository.save(updated);
  }

  public async reject(approvalId: string, user: RequestContext, reason?: string): Promise<Approval> {
    assertPermission(user.roles, "approval:decide");

    const approval = this.repository.get(approvalId);
    if (!approval || approval.status !== "pending") {
      throw new Error("APPROVAL_NOT_ACTIONABLE");
    }

    if (user.tenantId !== approval.tenantId) {
      throw new Error("TENANT_SCOPE_INVALID");
    }

    const updated: Approval = {
      ...approval,
      status: "rejected",
      decidedBy: user.actorId,
      reason,
      decidedAt: new Date().toISOString(),
    };

    return this.repository.save(updated);
  }

  public get(id: string): Approval | undefined {
    return this.repository.get(id);
  }

  public listPending(tenantId?: string): Approval[] {
    return this.repository.listPending(tenantId);
  }
}

export const approvalService = new ApprovalService();
