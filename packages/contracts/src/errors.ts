/**
 * AI Workbench - Error Codes & Standard Result Types
 * Phase: Sprint 1 Core Contracts
 */

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "TENANT_SCOPE_INVALID"
  | "WORKSPACE_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "RUN_NOT_EXECUTABLE"
  | "RUN_CANCELLED"
  | "RUN_VERSION_CONFLICT"
  | "POLICY_DENIED"
  | "APPROVAL_REQUIRED"
  | "BUDGET_EXCEEDED"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_TIMEOUT"
  | "TOOL_TIMEOUT"
  | "TOOL_NOT_FOUND"
  | "SANDBOX_TIMEOUT"
  | "SANDBOX_SECURITY_VIOLATION"
  | "ARTIFACT_LIMIT_EXCEEDED"
  | "SECRET_LEASE_EXPIRED"
  | "INVALID_CONTEXT_SIGNATURE"
  | "REPLAY_ATTACK_DETECTED"
  | "GITHUB_RATE_LIMIT"
  | "INTERNAL_ERROR";

export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  timestamp: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<T>(
  code: ErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, unknown>
): Result<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}
