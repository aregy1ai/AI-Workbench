/**
 * AI Workbench - Tool Call Idempotency Store
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolCall, ToolResponse } from "../../contracts/src/tool";

export interface StoredToolCall {
  id: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  toolName: string;
  toolVersion: string;
  status: string;
  idempotencyKey: string;
  requestHash: string;
  resultHash?: string;
  response?: ToolResponse;
  approvalId?: string;
  secretLeaseId?: string;
  createdAt: string;
  completedAt?: string;
}

export class ToolCallRepository {
  private calls = new Map<string, StoredToolCall>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> id

  public async findByIdempotencyKey(key: string): Promise<StoredToolCall | undefined> {
    const id = this.idempotencyIndex.get(key);
    if (!id) return undefined;
    return this.calls.get(id);
  }

  public async create(input: {
    tenantId: string;
    workspaceId: string;
    runId: string;
    stepId: string;
    toolName: string;
    toolVersion: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<StoredToolCall> {
    const id = `tcall_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const record: StoredToolCall = {
      id,
      ...input,
      status: "requested",
      createdAt: new Date().toISOString(),
    };

    this.calls.set(id, record);
    this.idempotencyIndex.set(input.idempotencyKey, id);
    return record;
  }

  public async markExecuting(id: string, secretLeaseId?: string): Promise<void> {
    const record = this.calls.get(id);
    if (record) {
      record.status = "executing";
      record.secretLeaseId = secretLeaseId;
    }
  }

  public async waitForApproval(id: string, approvalId: string): Promise<void> {
    const record = this.calls.get(id);
    if (record) {
      record.status = "requires_approval";
      record.approvalId = approvalId;
    }
  }

  public async complete(id: string, resultHash: string, response: ToolResponse): Promise<void> {
    const record = this.calls.get(id);
    if (record) {
      record.status = "succeeded";
      record.resultHash = resultHash;
      record.response = response;
      record.completedAt = new Date().toISOString();
    }
  }

  public async reject(id: string, reason: string): Promise<void> {
    const record = this.calls.get(id);
    if (record) {
      record.status = "rejected";
      record.completedAt = new Date().toISOString();
    }
  }

  public async fail(id: string, errorCode: string): Promise<void> {
    const record = this.calls.get(id);
    if (record) {
      record.status = "failed";
      record.completedAt = new Date().toISOString();
    }
  }

  public toResponse(record: StoredToolCall): ToolResponse {
    if (record.response) {
      return record.response;
    }
    return {
      status: "succeeded",
      result: { cached: true, toolCallId: record.id },
      artifactIds: [],
      auditEventId: `audit_cached_${record.id}`,
      retryable: false,
    };
  }

  public get(id: string): StoredToolCall | undefined {
    return this.calls.get(id);
  }

  public clear(): void {
    this.calls.clear();
    this.idempotencyIndex.clear();
  }
}

export const toolCallRepository = new ToolCallRepository();
