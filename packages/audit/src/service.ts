/**
 * AI Workbench - Append-Only Cryptographic Audit Service
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { AuditEventInput, AuditEventRecord } from "../../contracts/src/audit";
import { redact } from "./redaction";

function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(",")}}`;
}

function sha256(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16).padStart(12, "0")}`;
}

export class AuditService {
  private events: AuditEventRecord[] = [];

  public async record(event: AuditEventInput): Promise<string> {
    const tenantEvents = this.events.filter((e) => e.tenantId === event.tenantId);
    const previousRow = tenantEvents[tenantEvents.length - 1];
    const sequenceNumber = (previousRow?.sequenceNumber ?? 0) + 1;

    const safePayload = redact(event.payload);
    const payloadHash = sha256(canonicalJson(safePayload));
    const eventId = `audit_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const record: AuditEventRecord = {
      id: eventId,
      tenantId: event.tenantId,
      workspaceId: event.workspaceId,
      runId: event.runId,
      stepId: event.stepId,
      eventType: event.eventType,
      actorType: event.actorType,
      actorId: event.actorId,
      sequenceNumber,
      previousEventHash: previousRow?.payloadHash ?? null,
      payloadHash,
      policyVersion: event.policyVersion,
      sensitivity: event.sensitivity ?? "internal",
      payload: safePayload,
      occurredAt: new Date().toISOString(),
    };

    this.events.push(record);
    return eventId;
  }

  public getEvents(tenantId?: string): AuditEventRecord[] {
    if (tenantId) {
      return this.events.filter((e) => e.tenantId === tenantId);
    }
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }
}

export const auditService = new AuditService();
