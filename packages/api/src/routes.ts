/**
 * AI Workbench - Public API v1 Router & Envelopes
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { apiKeyService, ApiKeyRecord } from "./keys";
import { runRepository, Run } from "../../runs/src/run-repository";
import { runEngine } from "../../runs/src/run-engine";
import { auditLedger } from "../../audit/src/ledger";
import { approvalService } from "../../approvals/src/service";
import { artifactStore } from "../../artifacts/src/store";

export interface ApiResponse<T> {
  data: T;
  requestId: string;
  auditEventId?: string;
  nextCursor?: string;
  idempotentReplay?: boolean;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface CreateRunPayload {
  taskId: string;
  workspaceId: string;
  repositoryId?: string;
  branchName?: string;
  budgetLimit?: number;
}

export class PublicApiRouter {
  private idempotencyCache: Map<
    string,
    { result: ApiResponse<any>; timestamp: number }
  > = new Map();

  public async handleRequest(
    method: "GET" | "POST",
    path: string,
    rawApiKey: string,
    body?: any,
    idempotencyKey?: string
  ): Promise<{ status: number; body: ApiResponse<any> | ApiErrorResponse }> {
    const requestId = `req_${Math.random().toString(36).substring(2, 12)}`;

    // 1. Idempotency Check
    if (idempotencyKey && method === "POST") {
      const cached = this.idempotencyCache.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return {
          status: 200,
          body: { ...cached.result, idempotentReplay: true },
        };
      }
    }

    // 2. Authentication & Scope Verification
    const operationName = `${method}:${path.split("/")[2] || "root"}`;
    const authResult = apiKeyService.verifyKey(
      rawApiKey,
      operationName,
      body?.workspaceId,
      body?.repositoryId
    );

    if (!authResult.valid || !authResult.keyRecord) {
      return {
        status: 401,
        body: {
          error: {
            code: "UNAUTHORIZED",
            message: authResult.rejectionReason || "Invalid API Credentials",
            requestId,
          },
        },
      };
    }

    const { keyRecord } = authResult;
    const tenantId = keyRecord.scope.tenantId;

    try {
      // 3. Routing
      if (method === "POST" && path === "/v1/tasks") {
        return await this.handleCreateTask(requestId, tenantId, body, idempotencyKey);
      }

      if (method === "POST" && path === "/v1/runs") {
        return await this.handleCreateRun(requestId, tenantId, body, idempotencyKey);
      }

      if (method === "GET" && path.startsWith("/v1/runs/")) {
        const runId = path.split("/")[3];
        return await this.handleGetRun(requestId, tenantId, runId);
      }

      if (method === "POST" && path.match(/^\/v1\/runs\/[^/]+\/cancel$/)) {
        const runId = path.split("/")[3];
        return await this.handleCancelRun(requestId, tenantId, runId);
      }

      if (method === "GET" && path.match(/^\/v1\/runs\/[^/]+\/artifacts$/)) {
        const runId = path.split("/")[3];
        return await this.handleGetArtifacts(requestId, tenantId, runId);
      }

      if (method === "POST" && path.match(/^\/v1\/reviews\/[^/]+\/approve$/)) {
        const reviewId = path.split("/")[3];
        return await this.handleApproveReview(requestId, tenantId, reviewId, body);
      }

      return {
        status: 404,
        body: {
          error: {
            code: "NOT_FOUND",
            message: `Route not found: ${method} ${path}`,
            requestId,
          },
        },
      };
    } catch (err: any) {
      return {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_ERROR",
            message: err.message || "An unexpected error occurred",
            requestId,
          },
        },
      };
    }
  }

  private async handleCreateTask(
    requestId: string,
    tenantId: string,
    body: any,
    idempotencyKey?: string
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const taskId = `task_${Math.random().toString(36).substring(2, 10)}`;
    const event = auditLedger.record({
      runId: "sys_tasks",
      stepId: "step_task_create",
      eventType: "task.created",
      tenantId,
      actorType: "api_client",
      actorId: requestId,
      details: { taskId, prompt: body?.prompt, title: body?.title },
    });

    const response: ApiResponse<any> = {
      data: {
        id: taskId,
        title: body?.title || "Agent Execution Task",
        status: "pending",
        tenantId,
        createdAt: new Date().toISOString(),
      },
      requestId,
      auditEventId: event.id,
    };

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, {
        result: response,
        timestamp: Date.now(),
      });
    }

    return { status: 201, body: response };
  }

  private async handleCreateRun(
    requestId: string,
    tenantId: string,
    body: CreateRunPayload,
    idempotencyKey?: string
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const run = await runEngine.createRun({
      tenantId,
      workspaceId: body.workspaceId || "ws_default",
      taskId: body.taskId || "task_public_api",
      budgetLimit: body.budgetLimit ?? 25.0,
      runtimeName: "gvisor-production",
      runtimeVersion: "1.1.0",
    });

    const event = auditLedger.record({
      runId: run.id,
      stepId: "step_api_dispatch",
      eventType: "run.api_dispatched",
      tenantId,
      actorType: "api_client",
      actorId: requestId,
      details: { runId: run.id, budgetLimit: run.budgetLimit },
    });

    const response: ApiResponse<Run> = {
      data: run,
      requestId,
      auditEventId: event.id,
    };

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, {
        result: response,
        timestamp: Date.now(),
      });
    }

    return { status: 201, body: response };
  }

  private async handleGetRun(
    requestId: string,
    tenantId: string,
    runId: string
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const run = runRepository.get(runId);
    if (!run || run.tenantId !== tenantId) {
      throw new Error(`Run not found or access denied: ${runId}`);
    }

    return {
      status: 200,
      body: {
        data: run,
        requestId,
      },
    };
  }

  private async handleCancelRun(
    requestId: string,
    tenantId: string,
    runId: string
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const cancelled = await runEngine.cancelRun(runId, "Requested via Public API");
    return {
      status: 200,
      body: {
        data: { runId, status: cancelled.status, cancellationEpoch: cancelled.cancellationEpoch },
        requestId,
      },
    };
  }

  private async handleGetArtifacts(
    requestId: string,
    tenantId: string,
    runId: string
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const artifacts = artifactStore.listByRun(runId);
    return {
      status: 200,
      body: {
        data: artifacts,
        requestId,
      },
    };
  }

  private async handleApproveReview(
    requestId: string,
    tenantId: string,
    reviewId: string,
    body: any
  ): Promise<{ status: number; body: ApiResponse<any> }> {
    const user = {
      requestId,
      tenantId,
      actorId: body?.approverId || "api_user",
      actorType: "user" as const,
      roles: ["admin", "approver"],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    };
    const approved = await approvalService.approve(reviewId, user);

    return {
      status: 200,
      body: {
        data: { reviewId, approved: true, status: approved.status },
        requestId,
      },
    };
  }
}

export const publicApiRouter = new PublicApiRouter();
