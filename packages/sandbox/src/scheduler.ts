/**
 * AI Workbench - Sandbox Scheduler, gVisor Profiles & Secret Broker
 * Phase: Sprint 5 Sandbox Execution & Ephemeral Security
 */

import { SecretLease } from "../../contracts/src/tool";

export interface SandboxProfile {
  name: string;
  runtime: "gvisor" | "runc" | "firecracker";
  imageDigest: string;
  filesystem: "ephemeral" | "read_only";
  runAsUser: number;
  network: "none" | "allowlist" | "full";
  seccomp: "strict" | "default";
  cpuLimit: string;
  memoryLimit: string;
  pidsLimit: number;
  timeoutMs: number;
  artifactLimitBytes: number;
}

export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = {
  name: "isolated-gvisor-v1",
  runtime: "gvisor",
  imageDigest: "sha256:8f4b23d901a4e12c5b90321f64982a512cba04374358bbd43290f11ac8991ea4",
  filesystem: "ephemeral",
  runAsUser: 10001,
  network: "allowlist",
  seccomp: "strict",
  cpuLimit: "2",
  memoryLimit: "4Gi",
  pidsLimit: 256,
  timeoutMs: 1200000, // 20m
  artifactLimitBytes: 524288000, // 500Mi
};

export interface SandboxSession {
  sessionId: string;
  runId: string;
  profile: SandboxProfile;
  status: "provisioning" | "ready" | "executing" | "cleaning" | "destroyed";
  processTreeEmpty: boolean;
  filesystemSanitized: boolean;
  networkIdentityRotated: boolean;
  credentialsRevoked: boolean;
  createdAt: string;
  destroyedAt?: string;
}

export class SecretBroker {
  private leases: Map<string, SecretLease> = new Map();

  /**
   * Issues short-lived scoped credentials to sandbox or tool adapter
   */
  public issueLease(params: {
    tenantId: string;
    runId: string;
    toolName: string;
    ttlSeconds?: number;
  }): SecretLease {
    const ttl = params.ttlSeconds || 600;
    const leaseId = `lease_${Math.random().toString(36).substring(2, 10)}`;
    const now = Date.now();

    const lease: SecretLease = {
      id: leaseId,
      tenantId: params.tenantId,
      runId: params.runId,
      toolName: params.toolName,
      tokenValue: `scoped_tok_${Math.random().toString(36).substring(2, 16)}`,
      scope: [`tool:${params.toolName}:read_write`],
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl * 1000).toISOString(),
      revoked: false,
    };

    this.leases.set(lease.id, lease);
    return lease;
  }

  /**
   * Immediately revokes a secret lease
   */
  public revoke(leaseId: string): boolean {
    const lease = this.leases.get(leaseId);
    if (lease) {
      lease.revoked = true;
      lease.revokedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  public getActiveLeases(runId?: string): SecretLease[] {
    const all = Array.from(this.leases.values());
    if (runId) {
      return all.filter((l) => l.runId === runId && !l.revoked);
    }
    return all.filter((l) => !l.revoked);
  }

  public getAllLeases(): SecretLease[] {
    return Array.from(this.leases.values());
  }
}

export class SandboxScheduler {
  private sessions: Map<string, SandboxSession> = new Map();

  public provision(runId: string): SandboxSession {
    const sessionId = `sbx_${Math.random().toString(36).substring(2, 9)}`;
    const session: SandboxSession = {
      sessionId,
      runId,
      profile: DEFAULT_SANDBOX_PROFILE,
      status: "ready",
      processTreeEmpty: true,
      filesystemSanitized: true,
      networkIdentityRotated: true,
      credentialsRevoked: false,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public destroy(sessionId: string): SandboxSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "destroyed";
      session.processTreeEmpty = true;
      session.filesystemSanitized = true;
      session.credentialsRevoked = true;
      session.destroyedAt = new Date().toISOString();
      return session;
    }
    return undefined;
  }

  public getSession(sessionId: string): SandboxSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const secretBroker = new SecretBroker();
export const sandboxScheduler = new SandboxScheduler();
