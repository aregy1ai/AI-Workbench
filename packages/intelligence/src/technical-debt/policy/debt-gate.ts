/**
 * Eagle TDI v1 - Deterministic Technical Debt Gate
 *
 * The gate is policy authority. AI cannot emit BLOCK.
 */

import {
  DebtGateDecision,
  DebtGateDecisionRecord,
} from "../contracts/decision";
import { FindingCategory, FindingSeverity } from "../contracts/finding";

export const TDI_POLICY_VERSION = "tdi-v1.0";

export interface DebtGateInput {
  tdId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number;
  impact: number;
  debtScore: number;
  affectedBoundary?: string;
  evidenceVerified: boolean;
}

function decision(
  tdId: string,
  value: DebtGateDecision,
  policyApplied: string,
  reasonCode: string,
  reason: string,
  evidenceVerified: boolean,
): DebtGateDecisionRecord {
  return {
    id: `DEC-${tdId}-${value}`,
    tdId,
    decision: value,
    policyApplied,
    policyVersion: TDI_POLICY_VERSION,
    evidenceVerified,
    reasonCode,
    reason,
    decidedAt: new Date().toISOString(),
  };
}

export function evaluateDebtGate(input: DebtGateInput): DebtGateDecisionRecord {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("TDI_GATE_CONFIDENCE_OUT_OF_RANGE");
  }
  if (!Number.isFinite(input.impact) || input.impact < 0 || input.impact > 10) {
    throw new Error("TDI_GATE_IMPACT_OUT_OF_RANGE");
  }
  if (!Number.isFinite(input.debtScore) || input.debtScore < 0) {
    throw new Error("TDI_GATE_DEBT_SCORE_INVALID");
  }

  if (!input.evidenceVerified) {
    return decision(
      input.tdId,
      "BLOCK",
      "evidence-integrity",
      "EVIDENCE_UNVERIFIED",
      "Evidence integrity could not be verified; the gate fails closed.",
      false,
    );
  }

  if (
    input.affectedBoundary === "security-kernel" &&
    input.severity === "critical"
  ) {
    return decision(
      input.tdId,
      "BLOCK",
      "security-kernel-critical",
      "SECURITY_KERNEL_CRITICAL_DEBT",
      "Critical technical debt affects the security-kernel boundary.",
      true,
    );
  }

  if (
    input.category === "security" &&
    (input.severity === "critical" || input.severity === "high") &&
    input.confidence >= 0.85
  ) {
    return decision(
      input.tdId,
      "BLOCK",
      "verified-security-debt",
      "VERIFIED_HIGH_SECURITY_DEBT",
      "Verified high-severity security debt exceeded the confidence threshold.",
      true,
    );
  }

  if (input.category === "documentation" && input.impact <= 3) {
    return decision(
      input.tdId,
      "PASS",
      "low-value-documentation",
      "LOW_IMPACT_DOCUMENTATION",
      "Low-impact documentation debt does not block consolidation.",
      true,
    );
  }

  if (input.debtScore >= 75) {
    return decision(
      input.tdId,
      "REVIEW",
      "high-debt-score",
      "HIGH_DEBT_SCORE",
      "Debt score requires human review before consolidation.",
      true,
    );
  }

  return decision(
    input.tdId,
    "REVIEW",
    "default-review",
    "REVIEW_REQUIRED",
    "Finding is valid but does not satisfy an automatic PASS policy.",
    true,
  );
}
