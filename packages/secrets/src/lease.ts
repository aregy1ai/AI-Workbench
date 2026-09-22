/**
 * AI Workbench - Scoped Ephemeral Secret Lease Contract
 * Sprint 4: Policy Engine & Tool Gateway
 */

export interface SecretLease {
  id: string;
  secretType?: string;
  provider?: string;
  scope:
    | {
        repositoryId?: string;
        branch?: string;
        permissions: string[];
      }
    | string[];
  expiresAt: Date | string;
  status?: "active" | "revoked" | "expired";
  toolName?: string;
  tokenValue?: string;
  issuedAt?: Date | string;
  revoked?: boolean;
  revokedAt?: string;
  tenantId?: string;
  workspaceId?: string;
  runId?: string;
  toolCallId?: string;
}
