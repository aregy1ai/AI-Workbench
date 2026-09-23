/**
 * AI Workbench - GitHub Pull Request Types & Contracts
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface CreatePullRequestInput {
  tenantId: string;
  workspaceId: string;
  runId: string;
  repositoryId: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
}

export interface GitHubPullRequest {
  number: number;
  url: string;
  title?: string;
  state?: string;
}
