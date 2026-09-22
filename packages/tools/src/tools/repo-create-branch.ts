/**
 * AI Workbench - repo.create_branch Tool Definition
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "../../../contracts/src/tool";

export const repoCreateBranchTool: ToolDefinition = {
  name: "repo.create_branch",
  version: "1.0.0",
  requiredPermission: "repository:write",
  riskLevel: "medium",
  allowedResourceTypes: ["branch"],
  networkRequirements: ["github:write"],
  secretRequirements: ["github:contents:write"],
  maximumRuntimeMs: 20_000,
  maximumCost: 0,
  approvalRequired: false,
  idempotencyStrategy: "branch-name",
};

export interface CreateBranchInput {
  repositoryId: string;
  branchName: string;
  baseSha?: string;
}

export function validateCreateBranchInput(input: unknown): CreateBranchInput {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_TOOL_INPUT: Input must be an object");
  }
  const obj = input as Record<string, unknown>;
  if (!obj.repositoryId || typeof obj.repositoryId !== "string") {
    throw new Error("INVALID_TOOL_INPUT: repositoryId is required");
  }
  if (!obj.branchName || typeof obj.branchName !== "string" || obj.branchName.trim().length === 0) {
    throw new Error("INVALID_TOOL_INPUT: branchName is required");
  }
  return {
    repositoryId: obj.repositoryId,
    branchName: obj.branchName.trim(),
    baseSha: typeof obj.baseSha === "string" ? obj.baseSha : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  };
}
