/**
 * Eagle TDI v1 - Evidence Contract
 *
 * Evidence is the immutable, attributable input to technical-debt analysis.
 * AI may interpret evidence, but it may not manufacture or mutate it.
 */

export type EvidenceType =
  | "git"
  | "static_analysis"
  | "test"
  | "dependency"
  | "ci"
  | "security"
  | "architecture";

export interface Evidence {
  id: string;
  type: EvidenceType;

  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;

  source: string;
  path?: string;
  lineStart?: number;
  lineEnd?: number;

  collectedAt: string;

  /** SHA-256 digest of canonicalized evidence data. */
  contentDigest: string;

  data: Record<string, unknown>;
}

export function isSha256Digest(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(value);
}

export function validateEvidence(evidence: Evidence): void {
  if (!evidence.id.trim()) throw new Error("EVIDENCE_ID_REQUIRED");
  if (!evidence.tenantId.trim()) throw new Error("EVIDENCE_TENANT_REQUIRED");
  if (!evidence.workspaceId.trim()) throw new Error("EVIDENCE_WORKSPACE_REQUIRED");
  if (!evidence.repositoryId.trim()) throw new Error("EVIDENCE_REPOSITORY_REQUIRED");
  if (!/^[0-9a-f]{7,64}$/.test(evidence.commitSha)) {
    throw new Error("EVIDENCE_COMMIT_SHA_INVALID");
  }
  if (!isSha256Digest(evidence.contentDigest)) {
    throw new Error("EVIDENCE_DIGEST_INVALID");
  }
  if (evidence.lineStart !== undefined && evidence.lineStart < 1) {
    throw new Error("EVIDENCE_LINE_START_INVALID");
  }
  if (evidence.lineEnd !== undefined && evidence.lineEnd < 1) {
    throw new Error("EVIDENCE_LINE_END_INVALID");
  }
  if (
    evidence.lineStart !== undefined &&
    evidence.lineEnd !== undefined &&
    evidence.lineEnd < evidence.lineStart
  ) {
    throw new Error("EVIDENCE_LINE_RANGE_INVALID");
  }
}
