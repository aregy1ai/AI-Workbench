/**
 * AI Workbench - Policy Rules & Evaluation Matrix
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { PolicyDecision, PolicyInput } from "../../contracts/src/policy";

export const POLICY_VERSION = "v1.1";

export function allow(reasonCode: string = "DEFAULT_ALLOW"): PolicyDecision {
  return {
    decision: "allow",
    decisionId: `pol_dec_${Math.random().toString(36).substring(2, 9)}`,
    policyVersion: POLICY_VERSION,
    reasonCode,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

export function deny(reasonCode: string): PolicyDecision {
  return {
    decision: "deny",
    decisionId: `pol_dec_${Math.random().toString(36).substring(2, 9)}`,
    policyVersion: POLICY_VERSION,
    reasonCode,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

export function approval(approvalType: string, reasonCode: string = "HUMAN_REVIEW_REQUIRED"): PolicyDecision {
  return {
    decision: "approval_required",
    decisionId: `pol_dec_${Math.random().toString(36).substring(2, 9)}`,
    policyVersion: POLICY_VERSION,
    reasonCode,
    approvalType,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { context, tool, actorRoles, runStatus, remainingBudget } = input;

  if (runStatus !== "running") {
    return deny("RUN_NOT_EXECUTABLE");
  }

  if (context.riskLevel !== tool.riskLevel) {
    return deny("RISK_CONTEXT_MISMATCH");
  }

  if (remainingBudget < tool.maximumCost) {
    return deny("BUDGET_EXCEEDED");
  }

  if (tool.name === "github.merge_main") {
    return approval("MAIN_MERGE");
  }

  if (tool.name === "github.modify_workflow") {
    return approval("WORKFLOW_MODIFICATION");
  }

  if (
    tool.name === "workspace.apply_patch" &&
    !actorRoles.includes("developer") &&
    !actorRoles.includes("admin") &&
    !actorRoles.includes("owner")
  ) {
    return deny("INSUFFICIENT_ROLE");
  }

  if (tool.approvalRequired) {
    return approval("TOOL_POLICY");
  }

  return allow("DEFAULT_ALLOW");
}
