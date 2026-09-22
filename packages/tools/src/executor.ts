/**
 * AI Workbench - Tool Executor & Service Adapters
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "../../contracts/src/tool";
import { SecretLease } from "../../secrets/src/lease";

export interface ToolExecutionContext {
  lease?: SecretLease;
  timeoutMs: number;
  signal?: AbortSignal;
}

export class MockGithubAdapter {
  public readFileCalls = 0;
  public listTreeCalls = 0;
  public createBranchCalls = 0;
  public createdBranches = new Set<string>();

  public async readFile(input: { repositoryId: string; path: string; ref?: string; token?: SecretLease }) {
    this.readFileCalls++;
    return {
      path: input.path,
      sha: "f92a34891b0c03478912",
      size: 1420,
      content: `// Source code of ${input.path}\nexport const initialized = true;\nconst apiKey = "sk-sensitive-llm-token-98214"; // should be redacted\n`,
      encoding: "utf-8",
    };
  }

  public async listTree(input: { repositoryId: string; ref?: string; recursive?: boolean; token?: SecretLease }) {
    this.listTreeCalls++;
    return {
      sha: "tree_root_9182",
      truncated: false,
      tree: [
        { path: "src/index.ts", type: "blob", size: 1420 },
        { path: "src/auth/session.ts", type: "blob", size: 3200 },
        { path: "package.json", type: "blob", size: 840 },
        { path: "tsconfig.json", type: "blob", size: 512 },
      ],
    };
  }

  public async createBranch(input: { repositoryId: string; branchName: string; baseSha?: string; token?: SecretLease }) {
    this.createBranchCalls++;
    this.createdBranches.add(input.branchName);
    return {
      ref: `refs/heads/${input.branchName}`,
      sha: input.baseSha || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      created: true,
      repositoryId: input.repositoryId,
    };
  }

  public reset(): void {
    this.readFileCalls = 0;
    this.listTreeCalls = 0;
    this.createBranchCalls = 0;
    this.createdBranches.clear();
  }
}

export const mockGithubAdapter = new MockGithubAdapter();

export class ToolExecutor {
  public async execute(
    tool: ToolDefinition,
    input: any,
    context: ToolExecutionContext
  ): Promise<unknown> {
    if (tool.name === "repo.read_file") {
      return mockGithubAdapter.readFile({
        repositoryId: input?.repositoryId || "repo_default",
        path: input?.path || "README.md",
        ref: input?.ref,
        token: context.lease,
      });
    }

    if (tool.name === "repo.list_tree") {
      return mockGithubAdapter.listTree({
        repositoryId: input?.repositoryId || "repo_default",
        ref: input?.ref,
        recursive: input?.recursive,
        token: context.lease,
      });
    }

    if (tool.name === "repo.create_branch") {
      return mockGithubAdapter.createBranch({
        repositoryId: input?.repositoryId || "repo_default",
        branchName: input?.branchName || "feature-patch-1",
        baseSha: input?.baseSha,
        token: context.lease,
      });
    }

    if (tool.name === "workspace.apply_patch") {
      return {
        applied: true,
        filesModified: ["src/auth/session.ts"],
        hunks: 2,
      };
    }

    if (tool.name === "workspace.run_tests") {
      return {
        passed: true,
        testsRun: 14,
        durationMs: 1240,
        coverage: 92.4,
      };
    }

    return {
      executed: true,
      tool: tool.name,
      timestamp: new Date().toISOString(),
    };
  }
}

export const toolExecutor = new ToolExecutor();
