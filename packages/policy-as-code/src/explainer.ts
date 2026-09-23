/**
 * AI Workbench - Policy Decision Explainer & Transparent Auditing
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { RiskLevel } from "../../policy/src/risk-adaptive";
import { PolicyBundle } from "./compiler";
import { auditLedger } from "../../audit/src/ledger";

export interface PolicyDecisionExplanation {
  decisionId: string;
  result: "allow" | "deny" | "requires_approval";
  matchedRules: string[];
  rejectedRules: string[];
  effectiveScope: {
    tenantId: string;
    workspaceId?: string;
    repositoryId?: string;
  };
  riskLevel: RiskLevel;
  requiredApprovals: number;
  policyVersion: string;
  reason: string;
  evaluatedAt: string;
}

export class PolicyDecisionExplainer {
  private explanations: PolicyDecisionExplanation[] = [];

  /**
   * Evaluates an action request against a compiled policy bundle and provides a crystal-clear explanation
   */
  public explainDecision(
    bundle: PolicyBundle,
    request: {
      action: string;
      tenantId: string;
      workspaceId?: string;
      repositoryId?: string;
      approvalsProvided?: number;
      actorRole?: string;
    }
  ): PolicyDecisionExplanation {
    const matchedRules: string[] = [];
    const rejectedRules: string[] = [];
    let result: "allow" | "deny" | "requires_approval" = "deny";
    let requiredApprovals = 0;
    let riskLevel: RiskLevel = "low";
    let reason = "DEFAULT_DENY: No explicit allow or approve rule matched requested action";

    // Match rules sorted by priority
    for (const rule of bundle.rules) {
      const match =
        rule.toolPattern === request.action ||
        rule.toolPattern === "*" ||
        (rule.toolPattern.endsWith("*") && request.action.startsWith(rule.toolPattern.slice(0, -1)));

      if (match) {
        matchedRules.push(rule.ruleId);

        const isHighRiskAction =
          request.action.includes("drop") ||
          request.action.includes("merge") ||
          request.action.includes("secret") ||
          request.action.includes("purge") ||
          request.action.includes("egress");

        if (rule.decision === "deny") {
          result = "deny";
          reason = `EXPLICIT_DENY: Rule '${rule.ruleId}' explicitly forbids action '${request.action}'`;
          riskLevel = isHighRiskAction ? "critical" : "medium";
          break; // Deny terminates immediately
        }

        if (rule.decision === "require_approval") {
          requiredApprovals = rule.requiredApprovals;
          riskLevel = rule.dualApproverRequired || isHighRiskAction ? "critical" : "high";

          if ((request.approvalsProvided || 0) >= requiredApprovals) {
            result = "allow";
            reason = `APPROVED: Required approvals (${requiredApprovals}) satisfied under rule '${rule.ruleId}'`;
          } else {
            result = "requires_approval";
            reason = `APPROVAL_PENDING: Rule '${rule.ruleId}' mandates ${requiredApprovals} approver(s). Currently provided: ${request.approvalsProvided || 0}`;
          }
          break;
        }

        if (rule.decision === "allow") {
          result = "allow";
          reason = `PERMITTED: Rule '${rule.ruleId}' permits execution with priority ${rule.priority}`;
          riskLevel = isHighRiskAction ? "critical" : "low";
          break;
        }
      } else {
        rejectedRules.push(rule.ruleId);
      }
    }

    const explanation: PolicyDecisionExplanation = {
      decisionId: `pde_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      result,
      matchedRules,
      rejectedRules: rejectedRules.slice(0, 5), // Keep concise
      effectiveScope: {
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
      },
      riskLevel,
      requiredApprovals,
      policyVersion: bundle.version,
      reason,
      evaluatedAt: new Date().toISOString(),
    };

    this.explanations.unshift(explanation);

    auditLedger.record({
      tenantId: request.tenantId,
      eventType: "POLICY_DECISION_EXPLAINED",
      actorId: "policy_explainer",
      actorType: "system",
      details: {
        decisionId: explanation.decisionId,
        result: explanation.result,
        action: request.action,
        reason: explanation.reason,
        policyVersion: bundle.version,
      },
    });

    return explanation;
  }

  public getHistory(): PolicyDecisionExplanation[] {
    return [...this.explanations];
  }
}

export const policyDecisionExplainer = new PolicyDecisionExplainer();
