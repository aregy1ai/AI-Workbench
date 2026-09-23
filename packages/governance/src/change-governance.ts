/**
 * AI Workbench - Change Governance, Two-Person Rule & GA Launch Gates
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { auditLedger } from "../../audit/src/ledger";

export interface ReleaseManifest {
  releaseId: string;
  gitSha: string;
  serviceImages: Record<string, string>;
  sandboxImageDigests: Record<string, string>;
  databaseMigrationVersion: string;
  policyVersion: string;
  promptRegistryVersion: string;
  modelRoutingVersion: string;
  createdAt: string;
  approvedBy: string[];
}

export interface LaunchGate {
  stage: "GA-0" | "GA-1" | "GA-2" | "GA-3" | "GA-4";
  name: string;
  description: string;
  requiredSloWindowDays: number;
  maxOpenSev1: number;
  maxOpenSev2: number;
  securityReviewPassed: boolean;
  rollbackVerified: boolean;
  supportReady: boolean;
  active: boolean;
}

export const GA_LAUNCH_GATES: LaunchGate[] = [
  {
    stage: "GA-0",
    name: "Internal Production",
    description: "Internal team usage only, synthetic repositories, live telemetry monitoring.",
    requiredSloWindowDays: 7,
    maxOpenSev1: 0,
    maxOpenSev2: 1,
    securityReviewPassed: true,
    rollbackVerified: true,
    supportReady: true,
    active: true,
  },
  {
    stage: "GA-1",
    name: "Pilot Tenants (Design Partners)",
    description: "2-5 trusted design partners, daily spend cap, no automatic PR merging.",
    requiredSloWindowDays: 14,
    maxOpenSev1: 0,
    maxOpenSev2: 1,
    securityReviewPassed: true,
    rollbackVerified: true,
    supportReady: true,
    active: true,
  },
  {
    stage: "GA-2",
    name: "Invite-Only Customers",
    description: "Enterprise early access cohort with signed SLAs and dedicated Slack support.",
    requiredSloWindowDays: 21,
    maxOpenSev1: 0,
    maxOpenSev2: 0,
    securityReviewPassed: true,
    rollbackVerified: true,
    supportReady: true,
    active: true,
  },
  {
    stage: "GA-3",
    name: "Public Signup with Quotas",
    description: "Self-service developer onboarding with strict rate limits and trial spend caps.",
    requiredSloWindowDays: 30,
    maxOpenSev1: 0,
    maxOpenSev2: 0,
    securityReviewPassed: true,
    rollbackVerified: true,
    supportReady: true,
    active: true,
  },
  {
    stage: "GA-4",
    name: "General Availability (Full Commercial)",
    description: "Unrestricted enterprise rollout across multi-region clusters with 99.95% SLA.",
    requiredSloWindowDays: 30,
    maxOpenSev1: 0,
    maxOpenSev2: 0,
    securityReviewPassed: true,
    rollbackVerified: true,
    supportReady: true,
    active: true,
  },
];

export interface ChangeRecord {
  id: string;
  changeType: "policy_engine" | "github_permissions" | "sandbox_isolation" | "key_rotation" | "billing_calc";
  title: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  affectedComponents: string[];
  rollbackPlan: string;
  proposedBy: string;
  approvedBy: string[];
  status: "proposed" | "approved" | "rejected" | "deployed" | "rolled_back";
  createdAt: string;
}

export class ChangeGovernanceService {
  private changes: Map<string, ChangeRecord> = new Map();

  public proposeChange(
    changeType: ChangeRecord["changeType"],
    title: string,
    riskLevel: ChangeRecord["riskLevel"],
    affectedComponents: string[],
    rollbackPlan: string,
    proposedBy: string
  ): ChangeRecord {
    const record: ChangeRecord = {
      id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      changeType,
      title,
      riskLevel,
      affectedComponents,
      rollbackPlan,
      proposedBy,
      approvedBy: [],
      status: "proposed",
      createdAt: new Date().toISOString(),
    };

    this.changes.set(record.id, record);

    auditLedger.record({
      runId: "sys_governance",
      stepId: "step_change_propose",
      eventType: "governance.change_proposed",
      tenantId: "global",
      actorType: "engineer",
      actorId: proposedBy,
      details: { changeId: record.id, title, riskLevel, changeType },
    });

    return record;
  }

  public approveChange(changeId: string, approverId: string): ChangeRecord {
    const change = this.changes.get(changeId);
    if (!change) throw new Error(`Change record not found: ${changeId}`);

    // Two-Person Rule: Proposer cannot approve their own high/critical change
    if (change.proposedBy === approverId && (change.riskLevel === "high" || change.riskLevel === "critical")) {
      throw new Error("TWO_PERSON_RULE_VIOLATION: Proposer cannot approve their own high-risk change");
    }

    if (!change.approvedBy.includes(approverId)) {
      change.approvedBy.push(approverId);
    }

    // Require 2 distinct approvals for high or critical changes
    const requiredApprovals = change.riskLevel === "critical" || change.riskLevel === "high" ? 2 : 1;
    if (change.approvedBy.length >= requiredApprovals) {
      change.status = "approved";
    }

    auditLedger.record({
      runId: "sys_governance",
      stepId: "step_change_approve",
      eventType: "governance.change_approved",
      tenantId: "global",
      actorType: "security_officer",
      actorId: approverId,
      details: {
        changeId,
        approvers: change.approvedBy,
        newStatus: change.status,
      },
    });

    return change;
  }

  public listChanges(): ChangeRecord[] {
    return Array.from(this.changes.values());
  }

  public getProductionReleaseManifest(): ReleaseManifest {
    return {
      releaseId: "rel_2026_ga_v1.0.0",
      gitSha: "c7f9a24bb883c4e12e3a19b5d634289aa8123ef6",
      serviceImages: {
        "control-plane": "registry.workbench.internal/control-plane@sha256:4a12bc...",
        "tool-gateway": "registry.workbench.internal/tool-gateway@sha256:8b34de...",
        "sandbox-scheduler": "registry.workbench.internal/sandbox-scheduler@sha256:1f98aa...",
        "billing-engine": "registry.workbench.internal/billing-engine@sha256:9c55fe...",
      },
      sandboxImageDigests: {
        isolated: "sha256:7f9a24bb883c4e12e3a19b5d634289aa8123ef6b43290f11ac8991ea4012abcd",
        medium: "sha256:7f9a24bb883c4e12e3a19b5d634289aa8123ef6b43290f11ac8991ea4012abcd",
      },
      databaseMigrationVersion: "20260923_001_sprint11_ga",
      policyVersion: "2.1.0",
      promptRegistryVersion: "prompt_sys_v3.2",
      modelRoutingVersion: "routing_tier_hybrid_v1",
      createdAt: new Date().toISOString(),
      approvedBy: ["lead_security_officer", "principal_reliability_engineer"],
    };
  }
}

export const changeGovernance = new ChangeGovernanceService();
