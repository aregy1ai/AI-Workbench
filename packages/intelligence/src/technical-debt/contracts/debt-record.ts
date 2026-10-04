/**
 * Eagle TDI v1 - Debt Record Contract
 *
 * A debt record is the governed representation of a validated finding.
 */

import { FindingCategory, FindingSeverity } from "./finding";

export type DebtStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "accepted"
  | "rejected";

export interface DebtRecord {
  tdId: string;
  findingId: string;

  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number;

  repositoryId: string;
  commitSha: string;
  locationPath: string;
  locationSymbols: string[];

  evidenceIds: string[];
  evidenceHash: string;

  impact: number;
  risk: number;
  changeFrequency: number;
  remediationEffortHours: number;
  debtScore: number;

  status: DebtStatus;

  createdAt: string;
  dueAt?: string;
  closedAt?: string;

  owner?: string;
  adr?: string;
  accepted: boolean;
  reviewDueAt?: string;

  affectedBoundary?: string;
}

export function validateDebtRecord(record: DebtRecord): void {
  if (!/^TD-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(record.tdId)) {
    throw new Error("TD_ID_INVALID");
  }
  if (!record.findingId.trim()) throw new Error("TD_FINDING_ID_REQUIRED");
  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    throw new Error("TD_CONFIDENCE_OUT_OF_RANGE");
  }
  if (!Number.isFinite(record.impact) || record.impact < 0 || record.impact > 10) {
    throw new Error("TD_IMPACT_OUT_OF_RANGE");
  }
  if (!Number.isFinite(record.changeFrequency) || record.changeFrequency < 0) {
    throw new Error("TD_CHANGE_FREQUENCY_INVALID");
  }
  if (
    !Number.isFinite(record.remediationEffortHours) ||
    record.remediationEffortHours < 0
  ) {
    throw new Error("TD_REMEDIATION_EFFORT_INVALID");
  }
  if (!Number.isFinite(record.debtScore) || record.debtScore < 0) {
    throw new Error("TD_DEBT_SCORE_INVALID");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(record.evidenceHash)) {
    throw new Error("TD_EVIDENCE_HASH_INVALID");
  }
}
