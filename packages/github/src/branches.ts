/**
 * AI Workbench - GitHub Branch Types & Contracts
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface CreateBranchInput {
  tenantId: string;
  workspaceId: string;
  runId: string;
  repositoryId: string;
  branchName: string;
  baseSha: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  url: string;
}
