/**
 * AI Workbench - Agent Capability Review & Lifecycle Governance
 * Sprint 12: Continuous Improvement & Governance 2.0
 */

import { auditLedger } from "../../audit/src/ledger";
import { RiskLevel } from "../../../packages/policy/src/risk-adaptive";

export type CapabilityDecision = "retain" | "restrict" | "suspend" | "remove";

export interface CapabilityReview {
  id: string;
  agentId: string;
  capabilityName: string;
  riskLevel: RiskLevel;
  usageCount: number;
  rejectionCount: number;
  securityEvents: number;
  lastUsedAt?: string;
  owner: string;
  decision: CapabilityDecision;
  reviewNotes: string;
  reviewedAt: string;
  version: number;
  previousDecision?: CapabilityDecision;
}

export class AgentCapabilityReviewBoard {
  private capabilities: CapabilityReview[] = [];

  constructor() {
    this.seedCapabilities();
  }

  private seedCapabilities() {
    this.capabilities = [
      {
        id: "cap_01",
        agentId: "agent_code_crafter_v2",
        capabilityName: "fs.read_workspace",
        riskLevel: "low",
        usageCount: 14820,
        rejectionCount: 2,
        securityEvents: 0,
        lastUsedAt: new Date(Date.now() - 120_000).toISOString(),
        owner: "platform_team@enterprise.org",
        decision: "retain",
        reviewNotes: "Healthy high-volume read capability with 0.01% error margin",
        reviewedAt: new Date(Date.now() - 86400_000 * 5).toISOString(),
        version: 1,
      },
      {
        id: "cap_02",
        agentId: "agent_code_crafter_v2",
        capabilityName: "os.exec_raw_syscall",
        riskLevel: "critical",
        usageCount: 14,
        rejectionCount: 11,
        securityEvents: 4,
        lastUsedAt: new Date(Date.now() - 86400_000 * 35).toISOString(),
        owner: "security_council@enterprise.org",
        decision: "suspend",
        reviewNotes: "Excessive policy violations and low legitimate utility. Suspended pending cgroups isolation review.",
        reviewedAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
        version: 2,
        previousDecision: "restrict",
      },
      {
        id: "cap_03",
        agentId: "agent_qa_runner_v1",
        capabilityName: "network.external_egress",
        riskLevel: "high",
        usageCount: 0,
        rejectionCount: 0,
        securityEvents: 0,
        lastUsedAt: new Date(Date.now() - 86400_000 * 95).toISOString(),
        owner: "infra_lead@enterprise.org",
        decision: "remove",
        reviewNotes: "Zero usage in > 90 days. Removed to reduce attack surface.",
        reviewedAt: new Date(Date.now() - 86400_000 * 10).toISOString(),
        version: 3,
        previousDecision: "retain",
      },
      {
        id: "cap_04",
        agentId: "agent_doc_writer_v1",
        capabilityName: "github.create_pr_comment",
        riskLevel: "low",
        usageCount: 1205,
        rejectionCount: 1,
        securityEvents: 0,
        lastUsedAt: new Date(Date.now() - 3600_000).toISOString(),
        owner: "devrel@enterprise.org",
        decision: "retain",
        reviewNotes: "Complies with comment formatting standards",
        reviewedAt: new Date(Date.now() - 86400_000 * 15).toISOString(),
        version: 1,
      },
      {
        id: "cap_05",
        agentId: "agent_db_migrator_v1",
        capabilityName: "db.schema_ddl_alter",
        riskLevel: "critical",
        usageCount: 88,
        rejectionCount: 14,
        securityEvents: 2,
        lastUsedAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
        owner: "dba_lead@enterprise.org",
        decision: "restrict",
        reviewNotes: "Restricted to staging database schemas only. Production alters require manual Two-Person approval.",
        reviewedAt: new Date(Date.now() - 86400_000 * 1).toISOString(),
        version: 2,
        previousDecision: "retain",
      },
    ];
  }

  public listCapabilities(agentId?: string): CapabilityReview[] {
    if (agentId) {
      return this.capabilities.filter((c) => c.agentId === agentId);
    }
    return [...this.capabilities];
  }

  /**
   * Applies a governance review decision with versioning & audit trail
   */
  public updateDecision(
    id: string,
    decision: CapabilityDecision,
    reviewNotes: string,
    reviewerId: string
  ): CapabilityReview {
    const cap = this.capabilities.find((c) => c.id === id);
    if (!cap) throw new Error(`Capability ${id} not found`);

    cap.previousDecision = cap.decision;
    cap.decision = decision;
    cap.reviewNotes = reviewNotes;
    cap.reviewedAt = new Date().toISOString();
    cap.version++;

    auditLedger.record({
      tenantId: "system_governance",
      eventType: "CAPABILITY_REVIEW_UPDATED",
      actorId: reviewerId,
      actorType: "user",
      details: {
        capabilityId: id,
        agentId: cap.agentId,
        capabilityName: cap.capabilityName,
        oldDecision: cap.previousDecision,
        newDecision: decision,
        version: cap.version,
      },
    });

    return cap;
  }

  /**
   * Rolls back a capability to its previous decision state
   */
  public rollbackDecision(id: string, reviewerId: string): CapabilityReview {
    const cap = this.capabilities.find((c) => c.id === id);
    if (!cap) throw new Error(`Capability ${id} not found`);
    if (!cap.previousDecision) {
      throw new Error(`No previous decision state exists for capability ${id}`);
    }

    const targetDecision = cap.previousDecision;
    cap.previousDecision = cap.decision;
    cap.decision = targetDecision;
    cap.reviewNotes = `Rolled back to previous governance state (${targetDecision}) by ${reviewerId}`;
    cap.reviewedAt = new Date().toISOString();
    cap.version++;

    auditLedger.record({
      tenantId: "system_governance",
      eventType: "CAPABILITY_DECISION_ROLLED_BACK",
      actorId: reviewerId,
      actorType: "user",
      details: {
        capabilityId: id,
        restoredDecision: targetDecision,
        version: cap.version,
      },
    });

    return cap;
  }

  /**
   * Identifies capabilities overdue for review (e.g. unused > 90 days, critical risk, or security flags)
   */
  public getOverdueReviews(): CapabilityReview[] {
    const now = Date.now();
    return this.capabilities.filter((c) => {
      if (c.decision === "remove") return false;
      const lastReview = new Date(c.reviewedAt).getTime();
      const daysSinceReview = (now - lastReview) / (1000 * 60 * 60 * 24);

      if (c.securityEvents > 0) return true;
      if (c.riskLevel === "critical") return true;
      if (c.usageCount === 0) return true;
      if (daysSinceReview > 30) return true;

      return false;
    });
  }
}

export const agentCapabilityReviewBoard = new AgentCapabilityReviewBoard();
