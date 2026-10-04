/**
 * Eagle TDI v1 - Deterministic Gate Decision Contract
 *
 * This is an output of policy evaluation, never of the AI analyzer.
 */

export type DebtGateDecision = "PASS" | "REVIEW" | "BLOCK";

export interface DebtGateDecisionRecord {
  id: string;
  tdId: string;
  decision: DebtGateDecision;
  policyApplied: string;
  policyVersion: string;

  evidenceVerified: boolean;
  reasonCode: string;
  reason: string;

  decidedAt: string;
}

export function validateDebtGateDecision(
  decision: DebtGateDecisionRecord
): void {
  if (!/^DEC-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decision.id)) {
    throw new Error("DECISION_ID_INVALID");
  }
  if (!/^TD-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decision.tdId)) {
    throw new Error("DECISION_TD_ID_INVALID");
  }
  if (!decision.policyApplied.trim()) {
    throw new Error("DECISION_POLICY_REQUIRED");
  }
  if (!decision.policyVersion.trim()) {
    throw new Error("DECISION_POLICY_VERSION_REQUIRED");
  }
  if (!decision.reasonCode.trim()) {
    throw new Error("DECISION_REASON_CODE_REQUIRED");
  }
}
