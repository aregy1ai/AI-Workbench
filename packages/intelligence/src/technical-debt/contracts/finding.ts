/**
 * Eagle TDI v1 - Finding Contract
 *
 * AI output is deliberately limited to an explainable finding.
 * PASS/REVIEW/BLOCK is never part of this contract.
 */

export type FindingCategory =
  | "security"
  | "architecture"
  | "reliability"
  | "performance"
  | "testing"
  | "documentation"
  | "maintainability";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;

  /** AI confidence only; never a policy decision. */
  confidence: number;

  evidenceIds: string[];
  affectedPaths: string[];
  affectedSymbols?: string[];

  recommendation: string;
  explanation?: string;
}

export function validateFinding(finding: Finding): void {
  if (!/^FND-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(finding.id)) {
    throw new Error("FINDING_ID_INVALID");
  }
  if (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) {
    throw new Error("FINDING_CONFIDENCE_OUT_OF_RANGE");
  }
  if (finding.evidenceIds.length === 0) {
    throw new Error("FINDING_REQUIRES_EVIDENCE");
  }
  if (finding.affectedPaths.length === 0) {
    throw new Error("FINDING_REQUIRES_AFFECTED_PATH");
  }
  if (!finding.recommendation.trim()) {
    throw new Error("FINDING_RECOMMENDATION_REQUIRED");
  }
}
