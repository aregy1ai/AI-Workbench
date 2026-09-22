/**
 * AI Workbench - Observability & Structured Logger
 * Zero secrets in logs or traces
 */

export interface LogEvent {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  requestId?: string;
  tenantId?: string;
  runId?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export class StructuredLogger {
  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["secret", "token", "password", "key", "authorization"];
    const sanitized: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = "[REDACTED_BY_SECURITY_POLICY]";
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  public info(message: string, context?: { requestId?: string; tenantId?: string; meta?: Record<string, unknown> }) {
    this.emit({
      level: "info",
      message,
      requestId: context?.requestId,
      tenantId: context?.tenantId,
      meta: context?.meta ? this.sanitize(context.meta) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  public error(message: string, context?: { requestId?: string; tenantId?: string; meta?: Record<string, unknown> }) {
    this.emit({
      level: "error",
      message,
      requestId: context?.requestId,
      tenantId: context?.tenantId,
      meta: context?.meta ? this.sanitize(context.meta) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  private emit(event: LogEvent) {
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(event));
    }
  }
}

export const logger = new StructuredLogger();
