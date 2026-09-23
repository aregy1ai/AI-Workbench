/**
 * AI Workbench - TypeScript Client SDK
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { WorkbenchError, WorkbenchErrorCode } from "./errors";
import { publicApiRouter, ApiResponse, CreateRunPayload } from "../../api/src/routes";
import { Run } from "../../runs/src/run-repository";

export interface WorkbenchClientOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export class WorkbenchClient {
  private apiKey: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options: WorkbenchClientOptions) {
    if (!options.apiKey) {
      throw new Error("API Key is required to initialize WorkbenchClient");
    }
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private generateIdempotencyKey(): string {
    return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private async executeWithRetry<T>(
    operation: (idempotencyKey: string) => Promise<{ status: number; body: any }>
  ): Promise<ApiResponse<T>> {
    const idempotencyKey = this.generateIdempotencyKey();
    let attempt = 0;
    let delay = 100;

    while (attempt <= this.maxRetries) {
      try {
        const response = await operation(idempotencyKey);

        if (response.status >= 200 && response.status < 300) {
          return response.body as ApiResponse<T>;
        }

        const errBody = response.body?.error;
        const code: WorkbenchErrorCode =
          response.status === 401
            ? "UNAUTHORIZED"
            : response.status === 403
            ? "FORBIDDEN"
            : response.status === 429
            ? "RATE_LIMITED"
            : response.status === 404
            ? "RUN_NOT_FOUND"
            : response.status >= 500
            ? "RETRYABLE"
            : "INTERNAL";

        const isRetryable = code === "RETRYABLE" || code === "RATE_LIMITED";

        if (isRetryable && attempt < this.maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        throw new WorkbenchError(
          errBody?.message || "API request failed",
          code,
          errBody?.requestId || "req_unknown",
          isRetryable,
          response.status
        );
      } catch (err: any) {
        if (err instanceof WorkbenchError) throw err;

        if (attempt < this.maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        throw new WorkbenchError(
          err.message || "Network error",
          "INTERNAL",
          "req_network_failure",
          false
        );
      }
    }

    throw new WorkbenchError(
      "Max retries exceeded",
      "RETRYABLE",
      "req_exhausted",
      false
    );
  }

  public async createTask(prompt: string, title?: string): Promise<ApiResponse<any>> {
    return this.executeWithRetry((idem) =>
      publicApiRouter.handleRequest(
        "POST",
        "/v1/tasks",
        this.apiKey,
        { prompt, title },
        idem
      )
    );
  }

  public async createRun(payload: CreateRunPayload): Promise<ApiResponse<Run>> {
    return this.executeWithRetry<Run>((idem) =>
      publicApiRouter.handleRequest(
        "POST",
        "/v1/runs",
        this.apiKey,
        payload,
        idem
      )
    );
  }

  public async getRun(runId: string): Promise<ApiResponse<Run>> {
    return this.executeWithRetry<Run>(() =>
      publicApiRouter.handleRequest("GET", `/v1/runs/${runId}`, this.apiKey)
    );
  }

  public async cancelRun(runId: string): Promise<ApiResponse<any>> {
    return this.executeWithRetry((idem) =>
      publicApiRouter.handleRequest(
        "POST",
        `/v1/runs/${runId}/cancel`,
        this.apiKey,
        {},
        idem
      )
    );
  }

  public async getArtifacts(runId: string): Promise<ApiResponse<any[]>> {
    return this.executeWithRetry<any[]>(() =>
      publicApiRouter.handleRequest(
        "GET",
        `/v1/runs/${runId}/artifacts`,
        this.apiKey
      )
    );
  }

  public async approveReview(
    reviewId: string,
    comment?: string
  ): Promise<ApiResponse<any>> {
    return this.executeWithRetry((idem) =>
      publicApiRouter.handleRequest(
        "POST",
        `/v1/reviews/${reviewId}/approve`,
        this.apiKey,
        { comment },
        idem
      )
    );
  }
}
