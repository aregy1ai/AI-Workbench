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

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function canonicalPayload(event: {
  tenantId: string;
  workspaceId: string;
  actorId: string;
  eventType: string;
  payloadSummary: string;
  metadata: Record<string, unknown>;
}): string {
  return canonicalJson({
    actorId: event.actorId,
    eventType: event.eventType,
    metadata: event.metadata,
    payloadSummary: event.payloadSummary,
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
  });
}

function canonicalEvent(event: AuditEventRecord): string {
  return canonicalJson({
    actorId: event.actorId,
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payloadHash: event.payloadHash,
    previousEventHash: event.previousEventHash,
    runId: event.runId ?? null,
    sequenceNumber: event.sequenceNumber,
    sensitivity: event.sensitivity,
    stepId: event.stepId ?? null,
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
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
    sensitivity?: "internal" | "restricted" | "public";
  }): AuditEventRecord {
    const sequenceNumber = this.chain.length + 1;
    const previousEventHash =
      sequenceNumber === 1 ? GENESIS_HASH : this.chain[sequenceNumber - 2].eventHash;
    const metadata = event.metadata ?? {};
    const sensitivity = event.sensitivity ?? "internal";
    const occurredAt = new Date().toISOString();
    const eventId = "aud_" + randomUUID();

    const payloadHash = sha256(
      canonicalPayload({
        tenantId: event.tenantId,
        workspaceId: event.workspaceId,
        actorId: event.actorId,
        eventType: event.eventType,
        payloadSummary: event.payloadSummary,
        metadata,
      }),
    );

    const draft: AuditEventRecord = {
      eventId,
      tenantId: event.tenantId,
      workspaceId: event.workspaceId,
      runId: event.runId,
      stepId: event.stepId,
      actorId: event.actorId,
      eventType: event.eventType,
      sequenceNumber,
      previousEventHash,
      payloadHash,
      eventHash: "",
      sensitivity,
      payloadSummary: event.payloadSummary,
      metadata,
      occurredAt,
    };

    draft.eventHash = sha256(canonicalEvent(draft));
    this.chain.push(draft);
    return draft;
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
        return { intact: false, corruptedIndex: i, message: "HASH_LINK_BROKEN" };
      }

      const recomputedPayloadHash = sha256(
        canonicalPayload({
          tenantId: current.tenantId,
          workspaceId: current.workspaceId,
          actorId: current.actorId,
          eventType: current.eventType,
          payloadSummary: current.payloadSummary,
          metadata: current.metadata,
        }),
      );

      if (current.payloadHash !== recomputedPayloadHash) {
        return { intact: false, corruptedIndex: i, message: "AUDIT_PAYLOAD_TAMPERED" };
      }

      const recomputedEventHash = sha256(canonicalEvent(current));

      if (current.eventHash !== recomputedEventHash) {
        return { intact: false, corruptedIndex: i, message: "AUDIT_EVENT_HASH_MISMATCH" };
      }
    }

    return { intact: true, message: "AUDIT_SHA256_CHAIN_VALID" };
  }

  public tamperWithEvent(index: number, newSummary: string): void {
    if (this.chain[index]) this.chain[index].payloadSummary = newSummary;
  }
}

export const auditLedger = new AuditHashChainLedger();
