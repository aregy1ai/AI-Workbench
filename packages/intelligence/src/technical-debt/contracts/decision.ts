/**
 * Eagle TDI v1 - Deterministic Gate Decision Contract.
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

  /** Deterministic fingerprint of the decision inputs and policy. */
  decisionFingerprint: string;

  /** Operational timestamp; never used as a scoring/policy input. */
  decidedAt: string;
}

export function validateDebtGateDecision(
  decision: DebtGateDecisionRecord,
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
  if (!/^sha256:[0-9a-f]{64}$/.test(decision.decisionFingerprint)) {
    throw new Error("DECISION_FINGERPRINT_INVALID");
  }
}
