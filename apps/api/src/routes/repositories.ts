import { Router, Request, Response, NextFunction } from "express";
import { assertPermission } from "../../../../packages/authorization/src/authorize";

export interface RepositoryRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  provider: "github";
  externalId: string;
  fullName: string;
  defaultBranch: string;
  createdAt: string;
}

const inMemoryRepositories: RepositoryRecord[] = [
  {
    id: "repo_acme_core",
    tenantId: "tenant_acme_corp",
    workspaceId: "ws_acme_core",
    provider: "github",
    externalId: "gh_982412",
    fullName: "acme-corp/payment-gateway",
    defaultBranch: "main",
    createdAt: new Date().toISOString(),
  },
];

export const repositoriesRouter = Router();

repositoriesRouter.get("/v1/repositories", (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "repository:read");

    const filtered = inMemoryRepositories.filter((r) => r.tenantId === context.tenantId);
    res.json({
      data: filtered,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});

repositoriesRouter.post("/v1/repositories", (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context!;
    assertPermission(context.roles, "repository:write");

    const { workspaceId, fullName, defaultBranch = "main" } = req.body || {};
    if (!fullName) {
      res.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Repository fullName is required" },
        requestId: context.requestId,
      });
      return;
    }

    const newRepo: RepositoryRecord = {
      id: `repo_${Math.random().toString(36).substring(2, 9)}`,
      tenantId: context.tenantId,
      workspaceId: workspaceId || "ws_default",
      provider: "github",
      externalId: `gh_${Date.now()}`,
      fullName,
      defaultBranch,
      createdAt: new Date().toISOString(),
    };

    inMemoryRepositories.push(newRepo);

    res.status(201).json({
      data: newRepo,
      requestId: context.requestId,
    });
  } catch (error) {
    next(error);
  }
});
