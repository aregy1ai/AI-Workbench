/**
 * AI Workbench - Audit Ledger Bridge
 * Phase: Sprint 4/Sprint 11
 */

import { auditLedger as chainLedger, AuditEventRecord } from "./hash-chain";

export interface AuditRecordInput {
  runId?: string;
  stepId?: string;
  eventType: string;
  tenantId: string;
  actorType?: string;
  actorId: string;
  details?: Record<string, unknown>;
  workspaceId?: string;
}

export class AuditLedgerBridge {
  public record(input: AuditRecordInput): { id: string } {
    const record = chainLedger.append({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId || "ws_default",
      runId: input.runId,
      stepId: input.stepId,
      actorId: input.actorId || "system",
      eventType: input.eventType,
      payloadSummary: JSON.stringify(input.details || {}),
      metadata: {
        actorType: input.actorType || "service",
        ...input.details,
      },
    });

    return { id: record.eventId };
  }

  public getEvents(tenantId?: string): AuditEventRecord[] {
    return chainLedger.getEvents(tenantId);
  }
}

export const auditLedger = new AuditLedgerBridge();
export { chainLedger };
