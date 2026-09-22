/**
 * AI Workbench - Runs & Tasks REST API Handlers & Express Router
 * Sprint 2: Core Run Engine
 */

import { Router, Request, Response, NextFunction } from "express";
import { CreateRunInput, Run, Task } from "../../../../packages/contracts/src/run";
import { failure, Result, success } from "../../../../packages/contracts/src/errors";
import { RequestContext } from "../../../../packages/contracts/src/context";
import { authorization, assertPermission } from "../../../../packages/authorization/src/authorize";
import { runStateMachine } from "../../../../packages/runs/src/state-machine";
import { runService } from "../../../../packages/runs/src/run-service";
import { runRepository } from "../../../../packages/runs/src/run-repository";

export interface CreateTaskInput {
  workspaceId: string;
  repositoryId: string;
  title: string;
  description: string;
  baseBranch: string;
  budgetLimit: number;
}

export class RunApiRouter {
  private tasks: Map<string, Task> = new Map();

  public async createTask(
    input: CreateTaskInput,
    context: RequestContext
  ): Promise<Result<Task>> {
    assertPermission(context.roles, "run:create");

    const taskId = `task_${Math.random().toString(36).substring(2, 10)}`;
    const task: Task = {
      id: taskId,
      tenantId: context.tenantId,
      workspaceId: input.workspaceId,
      repositoryId: input.repositoryId,
      title: input.title,
      description: input.description,
      baseBranch: input.baseBranch || "main",
      requestedBy: context.actorId,
      riskLevel: "medium",
      status: "created",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    return success(task);
  }

  public async createRun(
    taskId: string,
    input: CreateRunInput,
    context: RequestContext
  ): Promise<Result<Run>> {
    try {
      const run = await runService.create(
        {
          taskId,
          workspaceId: input.workspaceId,
          budgetLimit: input.budgetLimit,
          clientRequestId: input.clientRequestId,
        },
        context
      );
      return success(run);
    } catch (e: any) {
      return failure("RUN_NOT_EXECUTABLE", e.message);
    }
  }

  public async getRun(runId: string, context: RequestContext): Promise<Result<Run>> {
    const run = runRepository.get(runId);
    if (!run || run.tenantId !== context.tenantId) {
      return failure("RUN_NOT_FOUND", `Run ${runId} not found`);
    }
    return success(run);
  }

  public async cancelRun(
    runId: string,
    context: RequestContext
  ): Promise<Result<Run>> {
    try {
      const cancelled = await runService.requestCancellation(runId, context);
      return success(cancelled);
    } catch (e: any) {
      return failure("RUN_NOT_FOUND", e.message);
    }
  }
}

export const runApiRouter = new RunApiRouter();

// Express HTTP Router
export const runsExpressRouter = Router();

// POST /v1/tasks/:taskId/runs
runsExpressRouter.post("/v1/tasks/:taskId/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "run:create");

    const { workspaceId, budgetLimit, clientRequestId } = req.body || {};
    if (!clientRequestId) {
      res.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "clientRequestId is required for idempotency" },
        requestId: context.requestId,
      });
      return;
    }

    const run = await runService.create(
      {
        taskId: req.params.taskId,
        workspaceId: workspaceId || "ws_default",
        budgetLimit: budgetLimit || 10.0,
        clientRequestId,
      },
      context
    );

    res.status(201).json({
      data: run,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /v1/runs/:runId/cancel
runsExpressRouter.post("/v1/runs/:runId/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "run:cancel");

    const run = await runService.requestCancellation(req.params.runId, context);

    res.json({
      data: run,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// GET /v1/runs/:runId
runsExpressRouter.get("/v1/runs/:runId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    const run = runRepository.get(req.params.runId);

    if (!run || run.tenantId !== context.tenantId) {
      res.status(404).json({
        error: { code: "RUN_NOT_FOUND", message: `Run ${req.params.runId} not found` },
        requestId: context.requestId,
      });
      return;
    }

    res.json({
      data: run,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});
