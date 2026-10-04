/**
 * Eagle TDI v1 - Deterministic Debt Scorer
 *
 * No model output controls score weights. The scorer is deterministic and
 * replayable from persisted inputs.
 */

import { FindingSeverity } from "../contracts/finding";

export interface DebtScoreInput {
  impact: number;                 // 0..10
  severity: FindingSeverity;
  confidence: number;             // 0..1
  changeFrequency: number;         // changes per measurement window
  remediationEffortHours: number; // >= 0
}

export interface DebtMetrics {
  impact: number;
  risk: number;
  changeFrequency: number;
  remediationEffortHours: number;
  remediationCostFactor: number;
  debtScore: number;
}

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  low: 0.25,
  medium: 0.50,
  high: 0.75,
  critical: 1.00,
};

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`DEBT_SCORE_${name.toUpperCase()}_INVALID`);
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
    (SEVERITY_WEIGHT[input.severity] * input.confidence).toFixed(4)
  );
  const remediationCostFactor = Number(
    (1 + input.remediationEffortHours / 40).toFixed(4)
  );

  const debtScore = Number(
    (
      input.impact *
      risk *
      input.changeFrequency *
      remediationCostFactor
    ).toFixed(4)
  );

  return {
    impact: input.impact,
    risk,
    changeFrequency: input.changeFrequency,
    remediationEffortHours: input.remediationEffortHours,
    remediationCostFactor,
    debtScore,
  };
}

export function severityWeight(severity: FindingSeverity): number {
  return SEVERITY_WEIGHT[severity];
}
