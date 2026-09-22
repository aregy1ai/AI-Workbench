/**
 * AI Workbench - Approval Repository
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { Approval } from "../../contracts/src/approval";

export class ApprovalRepository {
  private approvals = new Map<string, Approval>();

  public save(approval: Approval): Approval {
    this.approvals.set(approval.id, { ...approval });
    return approval;
  }

  public get(id: string): Approval | undefined {
    const item = this.approvals.get(id);
    return item ? { ...item } : undefined;
  }

  public listByTenant(tenantId: string): Approval[] {
    return Array.from(this.approvals.values()).filter((a) => a.tenantId === tenantId);
  }

  public listPending(tenantId?: string): Approval[] {
    const now = Date.now();
    return Array.from(this.approvals.values()).filter(
      (a) => a.status === "pending" && new Date(a.expiresAt).getTime() > now && (!tenantId || a.tenantId === tenantId)
    );
  }

  public clear(): void {
    this.approvals.clear();
  }
}

export const approvalRepository = new ApprovalRepository();
