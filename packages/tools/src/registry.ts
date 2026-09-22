/**
 * AI Workbench - Tool Registry
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "../../contracts/src/tool";
import { repoReadFileTool } from "./tools/repo-read-file";
import { repoListTreeTool } from "./tools/repo-list-tree";
import { repoCreateBranchTool } from "./tools/repo-create-branch";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.register(repoReadFileTool);
    this.register(repoListTreeTool);
    this.register(repoCreateBranchTool);

    // Policy-restricted sensitive tools
    this.register({
      name: "github.merge_main",
      version: "1.0.0",
      requiredPermission: "repository:admin",
      riskLevel: "critical",
      allowedResourceTypes: ["pull-request", "branch"],
      networkRequirements: ["github:write"],
      secretRequirements: ["github:pull_requests:write"],
      maximumRuntimeMs: 30_000,
      maximumCost: 0,
      approvalRequired: true,
      idempotencyStrategy: "run-base-head",
    });

    this.register({
      name: "github.modify_workflow",
      version: "1.0.0",
      requiredPermission: "repository:admin",
      riskLevel: "critical",
      allowedResourceTypes: ["workflow-file"],
      networkRequirements: ["github:write"],
      secretRequirements: ["github:workflows:write"],
      maximumRuntimeMs: 30_000,
      maximumCost: 0,
      approvalRequired: true,
      idempotencyStrategy: "patch-hash",
    });

    this.register({
      name: "workspace.apply_patch",
      version: "1.0.0",
      requiredPermission: "workspace:write",
      riskLevel: "medium",
      allowedResourceTypes: ["workspace-file"],
      networkRequirements: [],
      secretRequirements: [],
      maximumRuntimeMs: 15_000,
      maximumCost: 0.1,
      approvalRequired: false,
      idempotencyStrategy: "patch-hash",
    });

    this.register({
      name: "workspace.run_tests",
      version: "1.0.0",
      requiredPermission: "workspace:read",
      riskLevel: "low",
      allowedResourceTypes: ["sandbox-process"],
      networkRequirements: ["sandbox:internal"],
      secretRequirements: [],
      maximumRuntimeMs: 60_000,
      maximumCost: 0.25,
      approvalRequired: false,
      idempotencyStrategy: "custom",
    });
  }

  public register(tool: ToolDefinition): void {
    const key = `${tool.name}@${tool.version}`;
    this.tools.set(key, tool);
    this.tools.set(tool.name, tool); // default resolution
  }

  public resolve(toolName: string, toolVersion?: string): ToolDefinition {
    const key = toolVersion ? `${toolName}@${toolVersion}` : toolName;
    const tool = this.tools.get(key) || this.tools.get(toolName);
    if (!tool) {
      throw new Error(`TOOL_NOT_FOUND: Tool '${toolName}' (version: ${toolVersion || "latest"}) is not registered in ToolRegistry`);
    }
    return tool;
  }

  public list(): ToolDefinition[] {
    // Unique tools
    const unique = new Map<string, ToolDefinition>();
    for (const tool of this.tools.values()) {
      unique.set(tool.name, tool);
    }
    return Array.from(unique.values());
  }
}

export const toolRegistry = new ToolRegistry();
export const TOOL_REGISTRY = toolRegistry.list();

