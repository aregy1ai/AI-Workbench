/**
 * AI Workbench - Signed Execution Context with HMAC and nonce replay defense.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  ExecutionContextPayload,
  SignedExecutionContext,
} from "../../contracts/src/execution-context";
import { nonceStore } from "./nonce-store";

function encodeBase64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url<T>(token: string): T {
  let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as T;
}

export class ExecutionContextSigner {
  private readonly configuredSecret?: string;
  private readonly keyId: string;

  constructor(secretKey?: string, keyId: string = "key-v1") {
    this.configuredSecret = secretKey;
    this.keyId = keyId;
  }

  private getSecret(): Buffer {
    const secret = this.configuredSecret ?? process.env.EAGLE_CONTEXT_SIGNER_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("EXECUTION_CONTEXT_SIGNER_SECRET_REQUIRED");
    }
    return Buffer.from(secret, "utf8");
  }

  private computeSignature(payload: ExecutionContextPayload): string {
    const canonicalPayload = JSON.stringify({
      issuer: payload.issuer,
      keyId: payload.keyId,
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      stepId: payload.stepId,
      actorId: payload.actorId,
      requestedAction: payload.requestedAction,
      riskLevel: payload.riskLevel,
      policyVersion: payload.policyVersion,
      cancellationEpoch: payload.cancellationEpoch,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      nonce: payload.nonce,
    });

    const digest = createHmac("sha256", this.getSecret())
      .update(canonicalPayload, "utf8")
      .digest("base64url");

    return "hmac-sha256_" + this.keyId + "_" + digest;
  }

  public async create(
    input: Omit<ExecutionContextPayload, "issuedAt" | "expiresAt" | "nonce">,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: ExecutionContextPayload = {
      ...input,
      issuedAt: now,
      expiresAt: now + 300,
      nonce: "nonce_" + randomBytes(24).toString("base64url"),
    };

    await nonceStore.reserve(payload.nonce, payload.expiresAt);

    return encodeBase64Url({
      payload,
      signature: this.computeSignature(payload),
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

    if (decoded.payload.keyId !== this.keyId) {
      throw new Error("EXECUTION_CONTEXT_KEY_ID_MISMATCH");
    }

    const expectedSig = this.computeSignature(decoded.payload);
    const expected = Buffer.from(expectedSig, "utf8");
    const actual = Buffer.from(decoded.signature, "utf8");

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error("INVALID_EXECUTION_CONTEXT_SIGNATURE");
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.expiresAt <= now) {
      throw new Error("EXECUTION_CONTEXT_EXPIRED");
    }

    await nonceStore.consume(decoded.payload.nonce);
    return decoded.payload;
  }
}

export const executionContextSigner = new ExecutionContextSigner();
