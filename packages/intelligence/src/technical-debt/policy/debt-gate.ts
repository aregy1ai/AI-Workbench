/**
 * Eagle TDI v1 - Deterministic Technical Debt Gate.
 * A raw finding, including an AI finding, cannot manufacture trusted severity.
 */
import {
  DebtGateDecision,
  DebtGateDecisionRecord,
} from "../contracts/decision";
import { FindingSeverity } from "../contracts/finding";
import { PolicyFacts, assertTrustedClassification, canBlockFromPolicyFacts } from "./policy-facts";

export const TDI_POLICY_VERSION = "tdi-v1.1";

export interface DebtGateInput {
  tdId: string;
  confidence: number;
  impact: number;
  debtScore: number;
  policyFacts: PolicyFacts;
}

function decision(
  tdId: string,
  value: DebtGateDecision,
  policyApplied: string,
  reasonCode: string,
  reason: string,
  facts: PolicyFacts,
): DebtGateDecisionRecord {
  const canonical = [
    tdId,
    value,
    policyApplied,
    TDI_POLICY_VERSION,
    String(facts.evidenceVerified),
    String(facts.provenanceVerified),
    String(facts.contractValid),
    facts.affectedBoundary,
    facts.category,
    String(facts.securityRuleMatched),
    facts.trustedSeverity ?? "",
    facts.classificationSource,
    reasonCode,
    reason,
  ].join("|");

  const decisionFingerprint =
    "sha256:" +
    Array.from(new TextEncoder().encode(canonical))
      .reduce((hex, byte) => hex + byte.toString(16).padStart(2, "0"), "");

  return {
    id: "DEC-" + tdId + "-" + value,
    tdId,
    decision: value,
    policyApplied,
    policyVersion: TDI_POLICY_VERSION,
    evidenceVerified: facts.evidenceVerified,
    reasonCode,
    reason,
    decisionFingerprint,
    decidedAt: new Date().toISOString(),
  };
}

function assertInput(input: DebtGateInput): void {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("TDI_GATE_CONFIDENCE_OUT_OF_RANGE");
  }
  if (!Number.isFinite(input.impact) || input.impact < 0 || input.impact > 10) {
    throw new Error("TDI_GATE_IMPACT_OUT_OF_RANGE");
  }
  if (!Number.isFinite(input.debtScore) || input.debtScore < 0) {
    throw new Error("TDI_GATE_DEBT_SCORE_INVALID");
  }

  assertTrustedClassification(input.policyFacts);
}

function trustedSecuritySeverity(facts: PolicyFacts): FindingSeverity | undefined {
  if (!canBlockFromPolicyFacts(facts)) return undefined;
  if (!facts.securityRuleMatched) return undefined;
  return facts.trustedSeverity;
}

export function evaluateDebtGate(input: DebtGateInput): DebtGateDecisionRecord {
  assertInput(input);
  const facts = input.policyFacts;

  if (!facts.evidenceVerified || !facts.provenanceVerified || !facts.contractValid) {
    return decision(
      input.tdId,
      "BLOCK",
      "evidence-integrity",
      "EVIDENCE_OR_PROVENANCE_UNVERIFIED",
      "Evidence provenance or contract integrity could not be verified; the gate fails closed.",
      facts,
    );
  }

  const trustedSeverity = trustedSecuritySeverity(facts);

  if (
    facts.affectedBoundary === "security-kernel" &&
    trustedSeverity === "critical"
  ) {
    return decision(
      input.tdId,
      "BLOCK",
      "security-kernel-critical",
      "SECURITY_KERNEL_CRITICAL_DEBT",
      "Trusted critical debt affects the security-kernel boundary.",
      facts,
    );
  }

  if (
    facts.category === "security" &&
    (trustedSeverity === "critical" || trustedSeverity === "high") &&
    canBlockFromPolicyFacts(facts) &&
    input.confidence >= 0.85
  ) {
    return decision(
      input.tdId,
      "BLOCK",
      "verified-security-debt",
      "VERIFIED_HIGH_SECURITY_DEBT",
      "Verified high-severity security debt exceeded the confidence threshold.",
      facts,
    );
  }

  if (facts.category === "documentation" && input.impact <= 3) {
    return decision(
      input.tdId,
      "PASS",
      "low-value-documentation",
      "LOW_IMPACT_DOCUMENTATION",
      "Low-impact documentation debt does not block consolidation.",
      facts,
    );
  }

  if (input.debtScore >= 75) {
    return decision(
      input.tdId,
      "REVIEW",
      "high-debt-score",
      "HIGH_DEBT_SCORE",
      "Debt score requires human review before consolidation.",
      facts,
    );
  }

  return decision(
    input.tdId,
    "REVIEW",
    "default-review",
    "REVIEW_REQUIRED",
    "Finding is valid but does not satisfy an automatic PASS policy.",
    facts,
  );
}
