/**
 * AI Workbench - GitHub Operations Adapter with Idempotency & Secret Leases
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { CreateBranchInput, GitHubBranch } from "./branches";
import { CreatePullRequestInput, GitHubPullRequest } from "./pull-requests";
import { githubAppClient, GitHubAppClient } from "./app-client";
import { isAlreadyExistsError, classifyGitHubError } from "./errors";
import { secretBroker } from "../../secrets/src/broker";
import { redact } from "../../audit/src/redaction";

export interface GitHubOperationRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  operationType: "create_branch" | "create_pull_request" | "create_commit";
  idempotencyKey: string;
  requestHash: string;
  status: "started" | "succeeded" | "failed";
  externalId?: string;
  externalUrl?: string;
  responseHash?: string;
  failureCode?: string;
  createdAt: string;
  completedAt?: string;
}

export class GitHubAdapter {
  private operations: Map<string, GitHubOperationRecord> = new Map();

  constructor(private client: GitHubAppClient = githubAppClient) {}

  public async createBranch(input: CreateBranchInput): Promise<GitHubBranch> {
    const idempotencyKey = `branch:create:${input.repositoryId}:${input.branchName}:${input.baseSha}`;

    const existing = this.operations.get(idempotencyKey);
    if (existing && existing.status === "succeeded") {
      return {
        name: input.branchName,
        sha: existing.externalId!,
        url: existing.externalUrl!,
      };
    }

    const opId = `op_gh_${Math.random().toString(36).substring(2, 10)}`;
    const operation: GitHubOperationRecord = {
      id: opId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      operationType: "create_branch",
      idempotencyKey,
      requestHash: `req_${Math.random().toString(36).substring(2, 8)}`,
      status: "started",
      createdAt: new Date().toISOString(),
    };
    this.operations.set(idempotencyKey, operation);

    const token = await secretBroker.issueGitHubLease({
      repositoryId: input.repositoryId,
      permissions: ["contents:write"],
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      runId: input.runId,
    });

    try {
      const branch = await this.client.createReference({
        repository: input.repositoryId,
        ref: `refs/heads/${input.branchName}`,
        sha: input.baseSha,
        token: token.token,
      });

      operation.status = "succeeded";
      operation.externalId = branch.sha;
      operation.externalUrl = branch.url;
      operation.completedAt = new Date().toISOString();

      return branch;
    } catch (error: any) {
      if (isAlreadyExistsError(error)) {
        const branch = await this.client.getBranch(
          input.repositoryId,
          input.branchName
        );

        operation.status = "succeeded";
        operation.externalId = branch.sha;
        operation.externalUrl = branch.url;
        operation.completedAt = new Date().toISOString();

        return branch;
      }

      operation.status = "failed";
      operation.failureCode = classifyGitHubError(error);
      operation.completedAt = new Date().toISOString();
      throw error;
    } finally {
      await secretBroker.revoke(token.leaseId);
    }
  }

  public async createPullRequest(
    input: CreatePullRequestInput
  ): Promise<GitHubPullRequest> {
    const idempotencyKey = `pr:create:${input.runId}:${input.baseBranch}:${input.headBranch}`;

    const existing = this.operations.get(idempotencyKey);
    if (existing && existing.status === "succeeded") {
      return {
        number: Number(existing.externalId),
        url: existing.externalUrl!,
        title: input.title,
      };
    }

    const opId = `op_pr_${Math.random().toString(36).substring(2, 10)}`;
    const operation: GitHubOperationRecord = {
      id: opId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      operationType: "create_pull_request",
      idempotencyKey,
      requestHash: `req_pr_${Math.random().toString(36).substring(2, 8)}`,
      status: "started",
      createdAt: new Date().toISOString(),
    };
    this.operations.set(idempotencyKey, operation);

    try {
      const pr = await this.client.createPullRequest({
        repositoryId: input.repositoryId,
        base: input.baseBranch,
        head: input.headBranch,
        title: input.title,
        body: redact(input.body),
      });

      operation.status = "succeeded";
      operation.externalId = String(pr.number);
      operation.externalUrl = pr.url;
      operation.completedAt = new Date().toISOString();

      return pr;
    } catch (error: any) {
      operation.status = "failed";
      operation.failureCode = classifyGitHubError(error);
      operation.completedAt = new Date().toISOString();
      throw error;
    }
  }

  public getOperation(idempotencyKey: string): GitHubOperationRecord | undefined {
    return this.operations.get(idempotencyKey);
  }

  public getAllOperations(): GitHubOperationRecord[] {
    return Array.from(this.operations.values());
  }

  public clear(): void {
    this.operations.clear();
  }
}

export const githubAdapter = new GitHubAdapter();
