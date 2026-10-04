import { Evidence, EvidenceType } from "../contracts/evidence";

export type ToolOutputFormat =
  | "sarif-2.1.0"
  | "json"
  | "jsonl"
  | "spdx-2.3"
  | "cyclonedx"
  | "text";

export type ToolOutputTarget = "stdout" | "file";

export interface PinnedSource {
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
  sourceRoot: string;
}

export interface ToolInvocation {
  toolId: string;
  version: string;
  executable: string;
  args: string[];
  outputFormat: ToolOutputFormat;
  configDigest: string;
  ruleSet?: string;
  databaseVersion?: string;
}

export interface ToolOutputEnvelope {
  invocation: ToolInvocation;
  source: PinnedSource;
  stdout: string;
  stderr?: string;
  exitCode: number;
  /** Exact UTF-8 stdout digest, independent of timestamps/runtime metadata. */
  rawOutputDigest?: string;
  /** Deterministic digest of source + invocation + complete tool output envelope. */
  executionEnvelopeDigest?: string;
}

export interface ToolCommandSpec {
  executable: string;
  args: string[];
  outputTarget: ToolOutputTarget;
}

export interface EvidenceCollector {
  readonly id: string;
  readonly evidenceType: EvidenceType;
  collect(output: ToolOutputEnvelope): Evidence[];
}

export interface ToolDefinition {
  id: string;
  tier: "A" | "B" | "benchmark" | "blocked";
  version: string;
  outputFormat: ToolOutputFormat;
  licenseNote?: string;
  purpose: string;
  executable: string;
  buildCommands(root: string, outputFile: string): ToolCommandSpec[];
}
