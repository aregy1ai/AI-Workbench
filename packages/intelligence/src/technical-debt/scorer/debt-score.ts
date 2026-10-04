/**
 * Eagle TDI v1 - Deterministic Debt Scorer
 * The weights live in a versioned scoring policy so replay is explicit.
 */
import { FindingSeverity } from "../contracts/finding";
import { TDI_SCORING_POLICY, severityWeightFor } from "./scoring-policy";

export interface DebtScoreInput {
  impact: number;
  severity: FindingSeverity;
  confidence: number;
  changeFrequency: number;
  remediationEffortHours: number;
}

export interface DebtMetrics {
  scoringPolicyVersion: string;
  impact: number;
  risk: number;
  changeFrequency: number;
  remediationEffortHours: number;
  remediationCostFactor: number;
  debtScore: number;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error("DEBT_SCORE_" + name.toUpperCase() + "_INVALID");
}

export function calculateDebtMetrics(input: DebtScoreInput): DebtMetrics {
  assertFinite("impact", input.impact);
  assertFinite("confidence", input.confidence);
  assertFinite("change_frequency", input.changeFrequency);
  assertFinite("remediation_effort_hours", input.remediationEffortHours);

  if (input.impact < 0 || input.impact > 10) {
    throw new Error("DEBT_SCORE_IMPACT_OUT_OF_RANGE");
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error("DEBT_SCORE_CONFIDENCE_OUT_OF_RANGE");
  }
  if (input.changeFrequency < 0) {
    throw new Error("DEBT_SCORE_CHANGE_FREQUENCY_INVALID");
  }
  if (input.remediationEffortHours < 0) {
    throw new Error("DEBT_SCORE_REMEDIATION_EFFORT_INVALID");
  }

  const risk = Number(
    (severityWeightFor(input.severity) * input.confidence).toFixed(4),
  );
  const remediationCostFactor = Number(
    (1 + input.remediationEffortHours / TDI_SCORING_POLICY.remediationHoursBase).toFixed(4),
  );

  const debtScore = Number(
    (
      input.impact *
      risk *
      input.changeFrequency *
      remediationCostFactor
    ).toFixed(4),
  );

  return {
    scoringPolicyVersion: "tdi-score-v1.0",
    impact: input.impact,
    risk,
    changeFrequency: input.changeFrequency,
    remediationEffortHours: input.remediationEffortHours,
    remediationCostFactor,
    debtScore,
  };
}

export function severityWeight(severity: FindingSeverity): number {
  return severityWeightFor(severity);
}
