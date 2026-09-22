/**
 * AI Workbench - Nonce Store for Replay Attack Prevention
 * Sprint 4: Policy Engine & Tool Gateway
 */

interface StoredNonce {
  status: "reserved" | "consumed";
  expiresAt: number; // Unix timestamp in seconds
}

export class NonceStore {
  private nonces = new Map<string, StoredNonce>();

  public async reserve(nonce: string, expiresAt: number): Promise<void> {
    const existing = this.nonces.get(nonce);
    const now = Math.floor(Date.now() / 1000);

    if (existing && existing.expiresAt > now) {
      throw new Error("NONCE_ALREADY_RESERVED");
    }

    this.nonces.set(nonce, {
      status: "reserved",
      expiresAt,
    });
  }

  public async consume(nonce: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const record = this.nonces.get(nonce);

    if (!record) {
      throw new Error("NONCE_NOT_FOUND");
    }

    if (record.expiresAt <= now) {
      throw new Error("NONCE_EXPIRED");
    }

    if (record.status === "consumed") {
      throw new Error("NONCE_ALREADY_CONSUMED");
    }

    record.status = "consumed";
  }

  public clear(): void {
    this.nonces.clear();
  }
}

export const nonceStore = new NonceStore();
