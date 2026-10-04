/** Eagle TDI v1 - trusted deterministic policy facts.
 *
 * PolicyFacts is the only classification layer allowed to feed BLOCK rules.
 * AI confidence/severity is never sufficient to create a trusted severity.
 */

import { FindingCategory, FindingSeverity } from "../contracts/finding";

export type TdiBoundary =
  | "security-kernel"
  | "identity"
  | "tenant-isolation"
  | "data"
  | "infrastructure"
  | "application"
  | "ci"
  | "unknown";

export type ClassificationSource =
  | "trusted-tool"
  | "deterministic-policy"
  | "human"
  | "ai";

export interface PolicyFacts {
  evidenceVerified: boolean;
  provenanceVerified: boolean;
  contractValid: boolean;
  affectedBoundary: TdiBoundary;
  category: FindingCategory;
  securityRuleMatched: boolean;
  trustedSeverity?: FindingSeverity;
  classificationSource: ClassificationSource;
}

export function canBlockFromPolicyFacts(facts: PolicyFacts): boolean {
  return (
    facts.evidenceVerified &&
    facts.provenanceVerified &&
    facts.contractValid &&
    facts.classificationSource !== "ai"
  );
}

export function assertTrustedClassification(facts: PolicyFacts): void {
  if (facts.classificationSource === "ai" && facts.trustedSeverity !== undefined) {
    throw new Error("AI_MUST_NOT_SUPPLY_TRUSTED_SEVERITY");
  }

  if (
    facts.trustedSeverity !== undefined &&
    facts.classificationSource !== "trusted-tool" &&
    facts.classificationSource !== "deterministic-policy" &&
    facts.classificationSource !== "human"
  ) {
    throw new Error("TRUSTED_SEVERITY_SOURCE_INVALID");
  }
}
