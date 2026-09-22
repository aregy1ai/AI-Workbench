import { Request, Response, NextFunction } from "express";
import { RequestContext } from "../../../../packages/contracts/src/context";
import { assertContext } from "../../../../packages/auth/src/context";

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export function authContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = (req.headers["x-tenant-id"] as string) || "tenant_default";
  const actorId = (req.headers["x-actor-id"] as string) || "usr_anonymous";
  const actorRole = (req.headers["x-actor-role"] as string) || "developer";
  const requestId = req.requestId || `req_${Date.now()}`;

  const context: RequestContext = {
    requestId,
    tenantId,
    actorId,
    actorType: "user",
    roles: [actorRole],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
  };

  try {
    assertContext(context);
    req.context = context;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: err.message || "AUTH_REQUIRED",
        message: "Invalid or missing tenant execution context",
      },
      requestId,
    });
  }
}
