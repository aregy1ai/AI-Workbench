import { Router, Request, Response, NextFunction } from "express";
import { assertPermission } from "../../../../packages/authorization/src/authorize";
import { workspaceRepository } from "../../../../packages/database/src/workspace-repository";

export const workspacesRouter = Router();

// GET /v1/workspaces - List workspaces for active tenant
workspacesRouter.get("/v1/workspaces", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "workspace:read");

    const workspaces = await workspaceRepository.list(context);

    res.json({
      data: workspaces,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /v1/workspaces - Create workspace in active tenant
workspacesRouter.post("/v1/workspaces", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "workspace:write");

    const { name } = req.body || {};
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "Workspace name must be at least 2 characters",
          retryable: false,
        },
        requestId: context.requestId,
      });
      return;
    }

    const workspace = await workspaceRepository.create(context, name.trim());

    res.status(201).json({
      data: workspace,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});
