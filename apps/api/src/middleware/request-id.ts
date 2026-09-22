import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : `req_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
