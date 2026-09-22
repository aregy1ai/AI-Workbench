import express from "express";
import { requestIdMiddleware } from "./middleware/request-id";
import { authContextMiddleware } from "./middleware/auth-context";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { workspacesRouter } from "./routes/workspaces";
import { repositoriesRouter } from "./routes/repositories";
import { runsExpressRouter } from "./routes/runs";

export function createApiApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/health", healthRouter);

  // Authenticated endpoints
  app.use(authContextMiddleware);
  app.use(workspacesRouter);
  app.use(repositoriesRouter);
  app.use(runsExpressRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

export const apiApp = createApiApp();
