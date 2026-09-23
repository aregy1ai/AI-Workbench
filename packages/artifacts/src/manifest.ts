/**
 * AI Workbench - Artifact Manifest & Types
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export type ArtifactType =
  | "log"
  | "diff"
  | "test-report"
  | "coverage"
  | "snapshot"
  | "patch"
  | "metadata";

export interface ArtifactEntry {
  type: ArtifactType;
  relativePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface ArtifactManifest {
  runId: string;
  sessionId: string;
  artifacts: ArtifactEntry[];
}
