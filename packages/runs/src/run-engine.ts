/**
 * AI Workbench - Run Engine Facade
 * Phase: Sprint 2 / Sprint 11
 */

import { runService } from "./run-service";
import { runRepository } from "./run-repository";
import { Run } from "../../contracts/src/run";
import { RequestContext } from "../../contracts/src/context";

export const runEngine = {
  async createRun(params: {
    tenantId: string;
    workspaceId: string;
    taskId: string;
    budgetLimit: number;
    runtimeName: string;
    runtimeVersion: string;
  }): Promise<Run> {
    const context: RequestContext = {
      requestId: `req_${Date.now()}`,
      tenantId: params.tenantId,
      actorId: "api_client",
      actorType: "service",
      roles: ["admin", "operator"],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    };
    return runService.create(
      {
        taskId: params.taskId,
        workspaceId: params.workspaceId,
        budgetLimit: params.budgetLimit,
        clientRequestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      },
      context
    );
  },

  async cancelRun(runId: string, reason?: string): Promise<Run> {
    const run = runRepository.get(runId);
    if (!run) throw new Error("Run not found");
    const context: RequestContext = {
      requestId: `req_cancel_${Date.now()}`,
      tenantId: run.tenantId,
      actorId: "api_client",
      actorType: "service",
      roles: ["admin", "operator"],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    };
    return runService.requestCancellation(runId, context);
  },
};

