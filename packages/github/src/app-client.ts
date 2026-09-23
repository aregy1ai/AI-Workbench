/**
 * AI Workbench - GitHub App Client
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { GitHubBranch } from "./branches";
import { GitHubPullRequest } from "./pull-requests";

export class GitHubAppClient {
  public branchesCreated: number = 0;
  public pullRequestsCreated: number = 0;

  private branches: Map<string, GitHubBranch> = new Map();
  private pullRequests: Map<string, GitHubPullRequest> = new Map();

  public async createReference(params: {
    repository: string;
    ref: string;
    sha: string;
    token?: any;
  }): Promise<GitHubBranch> {
    this.branchesCreated++;
    const branchName = params.ref.replace("refs/heads/", "");
    const key = `${params.repository}:${branchName}`;

    if (this.branches.has(key)) {
      throw new Error(`Reference already exists: ${params.ref}`);
    }

    const branch: GitHubBranch = {
      name: branchName,
      sha: params.sha || `sha_${Math.random().toString(36).substring(2, 10)}`,
      url: `https://github.com/${params.repository}/tree/${branchName}`,
    };

    this.branches.set(key, branch);
    return branch;
  }

  public async getBranch(
    repository: string,
    branchName: string
  ): Promise<GitHubBranch> {
    const key = `${repository}:${branchName}`;
    const branch = this.branches.get(key);
    if (!branch) {
      return {
        name: branchName,
        sha: `sha_existing_${Math.random().toString(36).substring(2, 10)}`,
        url: `https://github.com/${repository}/tree/${branchName}`,
      };
    }
    return branch;
  }

  public async createPullRequest(params: {
    repositoryId: string;
    base: string;
    head: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequest> {
    this.pullRequestsCreated++;
    const prNumber = Math.floor(Math.random() * 900) + 100;
    const pr: GitHubPullRequest = {
      number: prNumber,
      url: `https://github.com/${params.repositoryId}/pull/${prNumber}`,
      title: params.title,
      state: "open",
    };

    const key = `${params.repositoryId}:${params.base}:${params.head}`;
    this.pullRequests.set(key, pr);
    return pr;
  }

  public async getRepository(repositoryId: string): Promise<any> {
    return {
      id: repositoryId,
      name: repositoryId.split("/")[1] || repositoryId,
      defaultBranch: "main",
      private: true,
    };
  }

  public async getFile(input: { repositoryId: string; path: string; ref?: string }): Promise<any> {
    return {
      path: input.path,
      content: "export const app = true;\n",
      encoding: "utf-8",
      sha: "file_sha_123",
    };
  }

  public async getTree(input: { repositoryId: string; treeSha: string }): Promise<any> {
    return {
      sha: input.treeSha,
      tree: [
        { path: "package.json", type: "blob", size: 120 },
        { path: "src/index.ts", type: "blob", size: 450 },
      ],
      truncated: false,
    };
  }

  public reset(): void {
    this.branches.clear();
    this.pullRequests.clear();
    this.branchesCreated = 0;
    this.pullRequestsCreated = 0;
  }
}

export const githubAppClient = new GitHubAppClient();
