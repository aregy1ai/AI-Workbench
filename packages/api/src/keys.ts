/**
 * AI Workbench - Public API Scoped Authentication & Key Management
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { auditLedger } from "../../audit/src/ledger";

export interface ApiCredentialScope {
  tenantId: string;
  workspaceIds: string[];
  allowedOperations: string[];
  allowedRepositories: string[];
  expiresAt: string;
  rateLimitProfile: "standard" | "high" | "unlimited";
}

export interface ApiKeyRecord {
  id: string;
  keyPrefix: string;
  hashedSecret: string;
  name: string;
  scope: ApiCredentialScope;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ApiVerificationResult {
  valid: boolean;
  keyRecord?: ApiKeyRecord;
  rejectionReason?: string;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16).padStart(16, "0")}`;
}

export class ApiKeyService {
  private keys: Map<string, ApiKeyRecord> = new Map();

  public generateKey(
    name: string,
    scope: ApiCredentialScope,
    actorId: string = "system"
  ): { keyId: string; rawKey: string; record: ApiKeyRecord } {
    const rawSecret = `wbk_${Math.random().toString(36).substring(2, 14)}_${Math.random().toString(36).substring(2, 14)}`;
    const keyPrefix = rawSecret.substring(0, 8);
    const hashedSecret = simpleHash(rawSecret);
    const keyId = `key_${Math.random().toString(36).substring(2, 10)}`;

    const record: ApiKeyRecord = {
      id: keyId,
      keyPrefix,
      hashedSecret,
      name,
      scope,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    this.keys.set(record.id, record);

    auditLedger.record({
      runId: "sys_api_keys",
      stepId: "step_keygen",
      eventType: "api_key.created",
      tenantId: scope.tenantId,
      actorType: "user",
      actorId,
      details: {
        keyId,
        keyPrefix,
        name,
        allowedOperations: scope.allowedOperations,
        expiresAt: scope.expiresAt,
      },
    });

    return { keyId, rawKey: rawSecret, record };
  }

  public verifyKey(
    rawKey: string,
    operation: string,
    workspaceId?: string,
    repositoryId?: string
  ): ApiVerificationResult {
    const hashed = simpleHash(rawKey);
    const key = Array.from(this.keys.values()).find(
      (k) => k.hashedSecret === hashed
    );

    if (!key) {
      return { valid: false, rejectionReason: "KEY_NOT_FOUND_OR_INVALID" };
    }

    if (key.status === "revoked") {
      return { valid: false, rejectionReason: "KEY_REVOKED" };
    }

    if (new Date(key.scope.expiresAt).getTime() < Date.now()) {
      key.status = "expired";
      return { valid: false, rejectionReason: "KEY_EXPIRED" };
    }

    // Check operation scope
    if (
      !key.scope.allowedOperations.includes("*") &&
      !key.scope.allowedOperations.includes(operation)
    ) {
      return {
        valid: false,
        rejectionReason: `OPERATION_NOT_PERMITTED: ${operation}`,
      };
    }

    // Check workspace scope
    if (
      workspaceId &&
      !key.scope.workspaceIds.includes("*") &&
      !key.scope.workspaceIds.includes(workspaceId)
    ) {
      return {
        valid: false,
        rejectionReason: `WORKSPACE_NOT_IN_SCOPE: ${workspaceId}`,
      };
    }

    // Check repository scope
    if (
      repositoryId &&
      !key.scope.allowedRepositories.includes("*") &&
      !key.scope.allowedRepositories.includes(repositoryId)
    ) {
      return {
        valid: false,
        rejectionReason: `REPOSITORY_NOT_IN_SCOPE: ${repositoryId}`,
      };
    }

    key.lastUsedAt = new Date().toISOString();
    return { valid: true, keyRecord: key };
  }

  public revokeKey(keyId: string, actorId: string = "admin"): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    key.status = "revoked";
    key.revokedAt = new Date().toISOString();

    auditLedger.record({
      runId: "sys_api_keys",
      stepId: "step_revoke",
      eventType: "api_key.revoked",
      tenantId: key.scope.tenantId,
      actorType: "user",
      actorId,
      details: { keyId, keyPrefix: key.keyPrefix },
    });

    return true;
  }

  public listKeys(tenantId: string): ApiKeyRecord[] {
    return Array.from(this.keys.values()).filter(
      (k) => k.scope.tenantId === tenantId
    );
  }
}

export const apiKeyService = new ApiKeyService();
