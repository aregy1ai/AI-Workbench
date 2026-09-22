/**
 * AI Workbench - Signed Execution Context with Nonce Replay Defense
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ExecutionContextPayload, SignedExecutionContext } from "../../contracts/src/execution-context";
import { nonceStore } from "./nonce-store";

function encodeBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url<T>(token: string): T {
  let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const json = decodeURIComponent(escape(atob(base64)));
  return JSON.parse(json) as T;
}

export class ExecutionContextSigner {
  private secretKey: string;
  private keyId: string;

  constructor(secretKey: string = "default-signer-secret-2026", keyId: string = "key-v1") {
    this.secretKey = secretKey;
    this.keyId = keyId;
  }

  private computeSignature(payload: ExecutionContextPayload): string {
    const raw = `${payload.tenantId}:${payload.runId}:${payload.stepId}:${payload.nonce}:${payload.expiresAt}:${this.secretKey}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `sig_${this.keyId}_${Math.abs(hash).toString(36)}`;
  }

  public async create(
    input: Omit<ExecutionContextPayload, "issuedAt" | "expiresAt" | "nonce">
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: ExecutionContextPayload = {
      ...input,
      issuedAt: now,
      expiresAt: now + 300, // 5 min TTL
      nonce: `nonce_${Math.random().toString(36).substring(2, 9)}_${now}`,
    };

    await nonceStore.reserve(payload.nonce, payload.expiresAt);

    const signature = this.computeSignature(payload);

    return encodeBase64Url({
      payload,
      signature,
    });
  }

  public async verify(token: string): Promise<ExecutionContextPayload> {
    let decoded: SignedExecutionContext;
    try {
      decoded = decodeBase64Url<SignedExecutionContext>(token);
    } catch {
      throw new Error("INVALID_EXECUTION_CONTEXT_FORMAT");
    }

    if (!decoded.payload || !decoded.signature) {
      throw new Error("MALFORMED_EXECUTION_CONTEXT");
    }

    const expectedSig = this.computeSignature(decoded.payload);
    if (decoded.signature !== expectedSig) {
      throw new Error("INVALID_EXECUTION_CONTEXT_SIGNATURE");
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.expiresAt <= now) {
      throw new Error("EXECUTION_CONTEXT_EXPIRED");
    }

    // Enforce Nonce replay defense
    await nonceStore.consume(decoded.payload.nonce);

    return decoded.payload;
  }
}

export const executionContextSigner = new ExecutionContextSigner();
