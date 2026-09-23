/**
 * AI Workbench - Client SDK Typed Errors
 * Sprint 11: General Availability & Ecosystem Platform
 */

export type WorkbenchErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "RUN_NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "RETRYABLE"
  | "INTERNAL";

export class WorkbenchError extends Error {
  public readonly code: WorkbenchErrorCode;
  public readonly requestId: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: WorkbenchErrorCode,
    requestId: string,
    retryable: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = "WorkbenchError";
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}
