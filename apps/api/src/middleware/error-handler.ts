import { Request, Response, NextFunction } from "express";

export interface NormalizedError {
  code: string;
  publicMessage: string;
  httpStatus: number;
  retryable: boolean;
}

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    if (error.message === "FORBIDDEN") {
      return {
        code: "FORBIDDEN",
        publicMessage: "Insufficient permissions to perform this action",
        httpStatus: 403,
        retryable: false,
      };
    }
    if (error.message === "TENANT_SCOPE_INVALID") {
      return {
        code: "TENANT_SCOPE_INVALID",
        publicMessage: "Tenant scope violation prohibited by RLS isolation policy",
        httpStatus: 403,
        retryable: false,
      };
    }
    if (error.message === "AUTH_REQUIRED") {
      return {
        code: "AUTH_REQUIRED",
        publicMessage: "Authentication or valid request context is required",
        httpStatus: 401,
        retryable: false,
      };
    }
  }

  return {
    code: "INTERNAL_ERROR",
    publicMessage: "An unexpected error occurred. No sensitive details exposed.",
    httpStatus: 500,
    retryable: true,
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const normalized = normalizeError(err);
  const requestId = req.requestId || "unknown";

  res.status(normalized.httpStatus).json({
    error: {
      code: normalized.code,
      message: normalized.publicMessage,
      retryable: normalized.retryable,
    },
    requestId,
  });
}
