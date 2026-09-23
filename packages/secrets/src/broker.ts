/**
 * AI Workbench - Secret Broker & Ephemeral Lease Issuer
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolRequest, ToolDefinition } from "../../contracts/src/tool";
import { SecretLease } from "./lease";

export class SecretBroker {
  private leases = new Map<string, SecretLease>();

  /**
   * Issues a short-lived scoped token for tool execution
   */
  public async issue(request: ToolRequest, tool: ToolDefinition, toolCallId?: string): Promise<SecretLease> {
    const ttlMs = Math.min(10 * 60_000, tool.maximumRuntimeMs + 60_000);
    const expiresAt = new Date(Date.now() + ttlMs);
    const leaseId = `sec_lease_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const lease: SecretLease = {
      id: leaseId,
      secretType: "github-scoped-token",
      provider: "github",
      scope: {
        permissions: [...tool.secretRequirements],
      },
      expiresAt,
      status: "active",
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      runId: request.runId,
      toolCallId: toolCallId ?? request.stepId,
    };

    this.leases.set(leaseId, lease);
    return lease;
  }

  public async issueGitHubLease(params: {
    repositoryId: string;
    permissions: string[];
    tenantId?: string;
    workspaceId?: string;
    runId?: string;
  }): Promise<{ leaseId: string; token: string }> {
    const ttlMs = 10 * 60_000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const leaseId = `sec_lease_gh_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const lease: SecretLease = {
      id: leaseId,
      secretType: "github-installation-token",
      provider: "github",
      scope: {
        repositoryId: params.repositoryId,
        permissions: params.permissions,
      },
      expiresAt,
      status: "active",
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      runId: params.runId,
    };

    this.leases.set(leaseId, lease);
    return { leaseId, token: `ghs_ephemeral_${Math.random().toString(36).substring(2, 16)}` };
  }

  /**
   * Atomically revokes a secret lease immediately upon tool completion or run cancellation
   */
  public async revoke(leaseId: string): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (lease && lease.status === "active") {
      lease.status = "revoked";
    }
  }

  public getActiveLeases(runId?: string): SecretLease[] {
    const now = Date.now();
    return Array.from(this.leases.values()).filter(
      (l) => l.status === "active" && new Date(l.expiresAt).getTime() > now && (!runId || l.runId === runId)
    );
  }

  public getLease(leaseId: string): SecretLease | undefined {
    return this.leases.get(leaseId);
  }

  public clear(): void {
    this.leases.clear();
  }
}

export const secretBroker = new SecretBroker();
