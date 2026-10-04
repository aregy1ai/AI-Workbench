/**
 * AI Workbench - SHA-256 hash-chained tamper-evident audit ledger.
 */
import { createHash, randomUUID } from "node:crypto";

export interface AuditEventRecord {
  eventId: string;
  tenantId: string;
  workspaceId: string;
  runId?: string;
  stepId?: string;
  actorId: string;
  eventType: string;
  sequenceNumber: number;
  previousEventHash: string;
  payloadHash: string;
  eventHash: string;
  sensitivity: "internal" | "restricted" | "public";
  payloadSummary: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

const GENESIS_HASH =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function sha256(value: string): string {
  return "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalPayload(event: {
  tenantId: string;
  actorId: string;
  eventType: string;
  payloadSummary: string;
  metadata: Record<string, unknown>;
}): string {
  return JSON.stringify({
    actorId: event.actorId,
    eventType: event.eventType,
    meta: event.metadata,
    summary: event.payloadSummary,
    tenantId: event.tenantId,
  });
}

export class AuditHashChainLedger {
  private chain: AuditEventRecord[] = [];

  public getEvents(tenantId?: string): AuditEventRecord[] {
    return tenantId
      ? this.chain.filter((event) => event.tenantId === tenantId)
      : [...this.chain];
  }

  public append(event: {
    tenantId: string;
    workspaceId: string;
    runId?: string;
    stepId?: string;
    actorId: string;
    eventType: string;
    payloadSummary: string;
    metadata?: Record<string, unknown>;
  }): AuditEventRecord {
    const sequenceNumber = this.chain.length + 1;
    const previousEventHash =
      sequenceNumber === 1
        ? GENESIS_HASH
        : this.chain[sequenceNumber - 2].eventHash;
    const metadata = event.metadata ?? {};

    const payloadHash = sha256(
      canonicalPayload({
        tenantId: event.tenantId,
        actorId: event.actorId,
        eventType: event.eventType,
        payloadSummary: event.payloadSummary,
        metadata,
      }),
    );

    const eventHash = sha256(
      JSON.stringify({
        eventType: event.eventType,
        payloadHash,
        previousEventHash,
        sequenceNumber,
      }),
    );

    const record: AuditEventRecord = {
      eventId: "aud_" + randomUUID(),
      tenantId: event.tenantId,
      workspaceId: event.workspaceId,
      runId: event.runId,
      stepId: event.stepId,
      actorId: event.actorId,
      eventType: event.eventType,
      sequenceNumber,
      previousEventHash,
      payloadHash,
      eventHash,
      sensitivity: "internal",
      payloadSummary: event.payloadSummary,
      metadata,
      occurredAt: new Date().toISOString(),
    };

    this.chain.push(record);
    return record;
  }

  public verifyIntegrity(): {
    intact: boolean;
    corruptedIndex?: number;
    message: string;
  } {
    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];
      const expectedPrevious =
        i === 0 ? GENESIS_HASH : this.chain[i - 1].eventHash;

      if (current.previousEventHash !== expectedPrevious) {
        return {
          intact: false,
          corruptedIndex: i,
          message: "HASH_LINK_BROKEN",
        };
      }

      const recomputedPayloadHash = sha256(
        canonicalPayload({
          tenantId: current.tenantId,
          actorId: current.actorId,
          eventType: current.eventType,
          payloadSummary: current.payloadSummary,
          metadata: current.metadata,
        }),
      );

      if (current.payloadHash !== recomputedPayloadHash) {
        return {
          intact: false,
          corruptedIndex: i,
          message: "AUDIT_PAYLOAD_TAMPERED",
        };
      }

      const recomputedEventHash = sha256(
        JSON.stringify({
          eventType: current.eventType,
          payloadHash: current.payloadHash,
          previousEventHash: current.previousEventHash,
          sequenceNumber: current.sequenceNumber,
        }),
      );

      if (current.eventHash !== recomputedEventHash) {
        return {
          intact: false,
          corruptedIndex: i,
          message: "AUDIT_EVENT_HASH_MISMATCH",
        };
      }
    }

    return {
      intact: true,
      message: "AUDIT_SHA256_CHAIN_VALID",
    };
  }

  public tamperWithEvent(index: number, newSummary: string): void {
    if (this.chain[index]) {
      this.chain[index].payloadSummary = newSummary;
    }
  }
}

export const auditLedger = new AuditHashChainLedger();
