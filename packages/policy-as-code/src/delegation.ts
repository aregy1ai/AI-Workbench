/**
 * AI Workbench - Scoped Short-Lived Delegated Execution
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { auditLedger } from "../../audit/src/ledger";

export interface DelegationGrant {
  grantId: string;
  issuerUserId: string;
  subjectAgentId: string;
  tenantId: string;
  allowedTools: string[];
  resourceScope: string[];
  maxCost: number;
  maxUses: number;
  currentUses: number;
  expiresAt: string;
  nonce: string;
  signature: string;
  isRevoked: boolean;
}

export interface DelegationExecutionResult {
  allowed: boolean;
  grantId: string;
  ephemeralTokenNonce?: string;
  rejectionReason?: string;
}

export class DelegationBroker {
  private grants: Map<string, DelegationGrant> = new Map();

  constructor() {
    this.seedGrants();
  }

  private seedGrants() {
    this.issueGrant({
      issuerUserId: "user_sec_lead_01",
      subjectAgentId: "agent_code_crafter_v2",
      tenantId: "tenant_fintech_01",
      allowedTools: ["github.create_pull_request", "linter.run", "test.execute"],
      resourceScope: ["repo:fintech-core:*"],
      maxCost: 2.5,
      maxUses: 5,
      ttlSeconds: 3600,
    });
  }

  public issueGrant(params: {
    issuerUserId: string;
    subjectAgentId: string;
    tenantId: string;
    allowedTools: string[];
    resourceScope: string[];
    maxCost: number;
    maxUses: number;
    ttlSeconds: number;
  }): DelegationGrant {
    // Invariant: Agent cannot issue delegation grants (only authenticated human users)
    if (params.issuerUserId.startsWith("agent_")) {
      throw new Error("AGENT_SUBDELEGATION_FORBIDDEN: Autonomous agents are prohibited from issuing delegation grants");
    }

    const grantId = `grant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nonce = `nonce_${Math.random().toString(36).substring(2, 10)}`;

    const grant: DelegationGrant = {
      grantId,
      issuerUserId: params.issuerUserId,
      subjectAgentId: params.subjectAgentId,
      tenantId: params.tenantId,
      allowedTools: params.allowedTools,
      resourceScope: params.resourceScope,
      maxCost: params.maxCost,
      maxUses: params.maxUses,
      currentUses: 0,
      expiresAt: new Date(Date.now() + params.ttlSeconds * 1000).toISOString(),
      nonce,
      signature: `sig_grant_hmac_${Math.random().toString(36).substring(2, 12)}`,
      isRevoked: false,
    };

    this.grants.set(grantId, grant);

    auditLedger.record({
      tenantId: params.tenantId,
      eventType: "DELEGATION_GRANT_ISSUED",
      actorId: params.issuerUserId,
      actorType: "user",
      details: { grantId, subjectAgentId: params.subjectAgentId, allowedTools: params.allowedTools },
    });

    return grant;
  }

  /**
   * Validates delegation grant and dispenses short-lived token
   */
  public authorizeDelegatedExecution(
    grantId: string,
    toolName: string,
    resource: string
  ): DelegationExecutionResult {
    const grant = this.grants.get(grantId);
    if (!grant) {
      return { allowed: false, grantId, rejectionReason: "DELEGATION_NOT_FOUND" };
    }

    if (grant.isRevoked) {
      return { allowed: false, grantId, rejectionReason: "DELEGATION_REVOKED" };
    }

    if (new Date(grant.expiresAt).getTime() < Date.now()) {
      return { allowed: false, grantId, rejectionReason: "DELEGATION_EXPIRED" };
    }

    if (grant.currentUses >= grant.maxUses) {
      return { allowed: false, grantId, rejectionReason: "MAX_USES_EXCEEDED" };
    }

    // Check tool allowlist
    const toolAllowed = grant.allowedTools.includes(toolName) || grant.allowedTools.includes("*");
    if (!toolAllowed) {
      return { allowed: false, grantId, rejectionReason: `TOOL_NOT_IN_DELEGATION_SCOPE: '${toolName}' is not allowed` };
    }

    // Check resource scope
    const resourceAllowed = grant.resourceScope.some((pattern) => {
      if (pattern.endsWith("*")) return resource.startsWith(pattern.slice(0, -1));
      return pattern === resource;
    });

    if (!resourceAllowed) {
      return { allowed: false, grantId, rejectionReason: `RESOURCE_OUT_OF_SCOPE: '${resource}' is outside delegation grant` };
    }

    grant.currentUses += 1;

    auditLedger.record({
      tenantId: grant.tenantId,
      eventType: "DELEGATION_EXECUTION_AUTHORIZED",
      actorId: grant.subjectAgentId,
      actorType: "agent",
      details: { grantId, toolName, usesRemaining: grant.maxUses - grant.currentUses },
    });

    return {
      allowed: true,
      grantId,
      ephemeralTokenNonce: `eph_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  public revokeGrant(grantId: string, revokerId: string): void {
    const grant = this.grants.get(grantId);
    if (grant) {
      grant.isRevoked = true;
      auditLedger.record({
        tenantId: grant.tenantId,
        eventType: "DELEGATION_GRANT_REVOKED",
        actorId: revokerId,
        actorType: "user",
        details: { grantId },
      });
    }
  }

  public getGrants(): DelegationGrant[] {
    return Array.from(this.grants.values());
  }
}

export const delegationBroker = new DelegationBroker();
