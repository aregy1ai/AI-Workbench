import { createHash } from "node:crypto";
import { stableStringify } from "./canonical-json";

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Digest(value: string | Uint8Array): string {
  return `sha256:${sha256Hex(value)}`;
}

export function digestJson(value: unknown): string {
  return sha256Digest(stableStringify(value));
}

export function deterministicEvidenceId(input: {
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
  evidenceType: string;
  source: string;
  path?: string;
  lineStart?: number;
  lineEnd?: number;
  contentDigest: string;
}): string {
  const key = stableStringify(input);
  return `EVD-${sha256Hex(key).slice(0, 40)}`;
}
