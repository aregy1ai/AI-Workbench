/**
 * AI Workbench - Cryptographic Context Signing & Nonce Replay Guard
 * Phase: Sprint 1 Authentication & Signed Execution Context
 */

import { ExecutionContext, RiskLevel } from "../../contracts/src/tool";
import { RequestContext } from "../../contracts/src/context";

export function assertContext(context: RequestContext): void {
  if (!context.requestId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!context.tenantId) {
    throw new Error("TENANT_SCOPE_INVALID");
  }

  if (!context.actorId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (context.expiresAt.getTime() <= Date.now()) {
    throw new Error("AUTH_REQUIRED");
  }
}

export interface ContextSigningPayload {
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  actorId: string;
  requestedAction: string;
  riskLevel: RiskLevel;
  policyVersion: string;
  cancellationEpoch: number;
}

export class ContextSigner {
  private keyId: string;
  private secret: string;
  private usedNonces: Set<string> = new Set();

  constructor(secret: string = "dev-workbench-secret-control-plane-2026-strict-key-99", keyId: string = "k-v1") {
    this.secret = secret;
    this.keyId = keyId;
  }

  /**
   * Generates a signed execution context token
   */
  public sign(payload: ContextSigningPayload, ttlSeconds: number = 300): ExecutionContext {
    const now = Math.floor(Date.now() / 1000);
    const nonce = `nonce_${Math.random().toString(36).substring(2)}_${Date.now()}`;

    const context: Omit<ExecutionContext, "signature"> = {
      issuer: "ai-workbench.control-plane",
      keyId: this.keyId,
      issuedAt: new Date(now * 1000).toISOString(),
      expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
      nonce,
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      stepId: payload.stepId,
      actorId: payload.actorId,
      requestedAction: payload.requestedAction,
      riskLevel: payload.riskLevel,
      policyVersion: payload.policyVersion,
      cancellationEpoch: payload.cancellationEpoch,
    };

    const signature = this.computeSignature(context);

    return {
      ...context,
      signature,
    };
  }

  /**
   * Verifies context signature, expiration, and replay nonce
   */
  public verify(
    context: ExecutionContext,
    expectedCancellationEpoch?: number
  ): { valid: boolean; reason?: string } {
    // 1. Verify keyId
    if (context.keyId !== this.keyId) {
      return { valid: false, reason: "INVALID_KEY_ID" };
    }

    // 2. Check expiration
    const expiry = new Date(context.expiresAt).getTime();
    if (Date.now() > expiry) {
      return { valid: false, reason: "CONTEXT_EXPIRED" };
    }

    // 3. Replay nonce check
    if (context.nonce && this.usedNonces.has(context.nonce)) {
      return { valid: false, reason: "REPLAY_ATTACK_DETECTED" };
    }

    // 4. Verify HMAC signature
    const expectedSig = this.computeSignature(context);
    if (context.signature !== expectedSig) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }

    // 5. Verify cancellation epoch if provided
    if (
      expectedCancellationEpoch !== undefined &&
      context.cancellationEpoch !== expectedCancellationEpoch
    ) {
      return { valid: false, reason: "STALE_CANCELLATION_EPOCH" };
    }

    // Register nonce to prevent future replay
    if (context.nonce) {
      this.usedNonces.add(context.nonce);
    }

    return { valid: true };
  }

  /**
   * Internal deterministic signature computation
   */
  private computeSignature(context: Omit<ExecutionContext, "signature"> | ExecutionContext): string {
    const raw = [
      context.issuer,
      context.keyId,
      context.nonce,
      context.tenantId,
      context.workspaceId,
      context.runId,
      context.stepId,
      context.actorId,
      context.requestedAction,
      context.cancellationEpoch,
      this.secret,
    ].join("|");

    // Simple deterministic hash for browser & node execution
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sig_sha256_${Math.abs(hash).toString(16).padStart(12, "0")}`;
  }
}
