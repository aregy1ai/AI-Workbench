/** Eagle TDI v1 - Versioned deterministic scoring policy. */
import { FindingSeverity } from "../contracts/finding";

export const TDI_SCORING_POLICY_VERSION = "tdi-score-v1.0";

export const TDI_SCORING_POLICY = Object.freeze({
  severityWeight: Object.freeze({
    low: 0.25,
    medium: 0.50,
    high: 0.90,
    critical: 1.00,
  } satisfies Record<FindingSeverity, number>),
  remediationHoursBase: 40,
});

export function severityWeightFor(
  severity: FindingSeverity,
): number {
  return TDI_SCORING_POLICY.severityWeight[severity];
}
