/**
 * AI Workbench - Risk-Adaptive Policy & Execution Matrix
 * Sprint 12: Continuous Improvement & Governance 2.0
 */

import { auditLedger } from "../../audit/src/ledger";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskPolicyRule {
  actionPattern: string;
  riskLevel: RiskLevel;
  requiredApprovals: number;
  dualApproverRequired: boolean;
  tracingLevel: "sampled" | "full_diff" | "immutable_audit" | "cryptographic_chain";
  description: string;
}

export interface RiskEvaluationResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  approvalsNeeded: number;
  dualApproverRequired: boolean;
  tracingLevel: "sampled" | "full_diff" | "immutable_audit" | "cryptographic_chain";
  decisionCode: string;
  reason: string;
}

export class RiskAdaptivePolicyEngine {
  private rules: RiskPolicyRule[] = [
    // Low risk: Read-only operations, linting, branch creation
    {
      actionPattern: "read:*",
      riskLevel: "low",
      requiredApprovals: 0,
      dualApproverRequired: false,
      tracingLevel: "sampled",
      description: "Read workspace files, inspect AST, view test reports",
    },
    {
      actionPattern: "git:checkout",
      riskLevel: "low",
      requiredApprovals: 0,
      dualApproverRequired: false,
      tracingLevel: "sampled",
      description: "Checkout or create local scratch branch in sandbox",
    },
    {
      actionPattern: "linter:run",
      riskLevel: "low",
      requiredApprovals: 0,
      dualApproverRequired: false,
      tracingLevel: "sampled",
      description: "Static code analysis without side-effects",
    },

    // Medium risk: Sandbox modifications, commit, run test suites
    {
      actionPattern: "patch:apply",
      riskLevel: "medium",
      requiredApprovals: 0,
      dualApproverRequired: false,
      tracingLevel: "full_diff",
      description: "Apply unified diff within isolated sandbox workspace",
    },
    {
      actionPattern: "test:run",
      riskLevel: "medium",
      requiredApprovals: 0,
      dualApproverRequired: false,
      tracingLevel: "full_diff",
      description: "Execute containerized test suite with CPU/memory limits",
    },

    // High risk: CI workflows, restricted credentials, config changes
    {
      actionPattern: "github:workflow_edit",
      riskLevel: "high",
      requiredApprovals: 1,
      dualApproverRequired: false,
      tracingLevel: "immutable_audit",
      description: "Modify GitHub Actions YAML or CI/CD pipelines",
    },
    {
      actionPattern: "vault:access_restricted",
      riskLevel: "high",
      requiredApprovals: 1,
      dualApproverRequired: false,
      tracingLevel: "immutable_audit",
      description: "Access scoped restricted production staging secrets",
    },

    // Critical risk: Production deployments, merge to main, delete data, policy changes
    {
      actionPattern: "github:merge_main",
      riskLevel: "critical",
      requiredApprovals: 2,
      dualApproverRequired: true,
      tracingLevel: "cryptographic_chain",
      description: "Fast-forward or merge pull request into protected main branch",
    },
    {
      actionPattern: "cloud:deploy_production",
      riskLevel: "critical",
      requiredApprovals: 2,
      dualApproverRequired: true,
      tracingLevel: "cryptographic_chain",
      description: "Trigger production Kubernetes rollout or DNS change",
    },
    {
      actionPattern: "policy:modify_engine",
      riskLevel: "critical",
      requiredApprovals: 2,
      dualApproverRequired: true,
      tracingLevel: "cryptographic_chain",
      description: "Update core authorization rules or tenant isolation boundaries",
    },
    {
      actionPattern: "database:drop_or_truncate",
      riskLevel: "critical",
      requiredApprovals: 2,
      dualApproverRequired: true,
      tracingLevel: "cryptographic_chain",
      description: "Destructive table or database drops",
    },
  ];

  public evaluateAction(action: string, actorRoles: string[]): RiskEvaluationResult {
    // Find matching rule or match prefix
    const matched = this.rules.find((r) => {
      if (r.actionPattern === action) return true;
      if (r.actionPattern.endsWith("*")) {
        const prefix = r.actionPattern.slice(0, -1);
        return action.startsWith(prefix);
      }
      return false;
    });

    if (!matched) {
      // Default to high risk for uncataloged actions
      return {
        allowed: false,
        riskLevel: "high",
        approvalRequired: true,
        approvalsNeeded: 1,
        dualApproverRequired: false,
        tracingLevel: "immutable_audit",
        decisionCode: "UNCATALOGED_ACTION_RESTRICTED",
        reason: `Action '${action}' is not in policy catalog. Requires review.`,
      };
    }

    if (matched.riskLevel === "low") {
      return {
        allowed: true,
        riskLevel: "low",
        approvalRequired: false,
        approvalsNeeded: 0,
        dualApproverRequired: false,
        tracingLevel: matched.tracingLevel,
        decisionCode: "AUTO_PERMITTED_LOW_RISK",
        reason: matched.description,
      };
    }

    if (matched.riskLevel === "medium") {
      return {
        allowed: true,
        riskLevel: "medium",
        approvalRequired: false,
        approvalsNeeded: 0,
        dualApproverRequired: false,
        tracingLevel: matched.tracingLevel,
        decisionCode: "PERMITTED_SANDBOX_CONTAINED",
        reason: matched.description,
      };
    }

    if (matched.riskLevel === "high") {
      return {
        allowed: false,
        riskLevel: "high",
        approvalRequired: true,
        approvalsNeeded: 1,
        dualApproverRequired: false,
        tracingLevel: matched.tracingLevel,
        decisionCode: "HIGH_RISK_HUMAN_APPROVAL_REQUIRED",
        reason: `${matched.description} - Requires verified human reviewer.`,
      };
    }

    // Critical: Requires 2 distinct approvers
    return {
      allowed: false,
      riskLevel: "critical",
      approvalRequired: true,
      approvalsNeeded: 2,
      dualApproverRequired: true,
      tracingLevel: matched.tracingLevel,
      decisionCode: "CRITICAL_TWO_PERSON_APPROVAL_REQUIRED",
      reason: `${matched.description} - Requires two independent security officers under Two-Person Rule.`,
    };
  }

  public getRules(): RiskPolicyRule[] {
    return [...this.rules];
  }
}

export const riskAdaptivePolicyEngine = new RiskAdaptivePolicyEngine();
