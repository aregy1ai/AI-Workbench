/**
 * AI Workbench - repo.list_tree Tool Definition
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "../../../contracts/src/tool";

export const repoListTreeTool: ToolDefinition = {
  name: "repo.list_tree",
  version: "1.0.0",
  requiredPermission: "repository:read",
  riskLevel: "low",
  allowedResourceTypes: ["repository"],
  networkRequirements: ["github:read"],
  secretRequirements: ["github:contents:read"],
  maximumRuntimeMs: 15_000,
  maximumCost: 0,
  approvalRequired: false,
  idempotencyStrategy: "read",
};

export interface ListTreeInput {
  repositoryId: string;
  ref?: string;
  recursive?: boolean;
}

export function validateListTreeInput(input: unknown): ListTreeInput {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_TOOL_INPUT: Input must be an object");
  }
  const obj = input as Record<string, unknown>;
  if (!obj.repositoryId || typeof obj.repositoryId !== "string") {
    throw new Error("INVALID_TOOL_INPUT: repositoryId is required");
  }
  return {
    repositoryId: obj.repositoryId,
    ref: typeof obj.ref === "string" ? obj.ref : "main",
    recursive: Boolean(obj.recursive),
  };
}
