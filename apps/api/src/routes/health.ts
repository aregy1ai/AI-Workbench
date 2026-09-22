import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "@workbench/api",
    version: "1.0.0",
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});
