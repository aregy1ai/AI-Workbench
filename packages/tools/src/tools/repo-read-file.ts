/**
 * AI Workbench - repo.read_file Tool Definition
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "../../../contracts/src/tool";

export const repoReadFileTool: ToolDefinition = {
  name: "repo.read_file",
  version: "1.0.0",
  requiredPermission: "repository:read",
  riskLevel: "low",
  allowedResourceTypes: ["repository-file"],
  networkRequirements: ["github:read"],
  secretRequirements: ["github:contents:read"],
  maximumRuntimeMs: 10_000,
  maximumCost: 0,
  approvalRequired: false,
  idempotencyStrategy: "read",
};

export interface ReadFileInput {
  repositoryId: string;
  path: string;
  ref?: string;
}

export function validateReadFileInput(input: unknown): ReadFileInput {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_TOOL_INPUT: Input must be an object");
  }
  const obj = input as Record<string, unknown>;
  if (!obj.repositoryId || typeof obj.repositoryId !== "string") {
    throw new Error("INVALID_TOOL_INPUT: repositoryId is required");
  }
  if (!obj.path || typeof obj.path !== "string") {
    throw new Error("INVALID_TOOL_INPUT: path is required");
  }
  return {
    repositoryId: obj.repositoryId,
    path: obj.path,
    ref: typeof obj.ref === "string" ? obj.ref : "main",
  };
}
