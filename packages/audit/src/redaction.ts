/**
 * AI Workbench - Output Redaction Engine
 * Sprint 4: Policy Engine & Tool Gateway
 */

export const sensitivePatterns: RegExp[] = [
  /gh[pousr]_[A-Za-z0-9_]+/g,
  /sk-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z-_]{35}/g,
];

export function redact(value: unknown): any {
  if (typeof value === "string") {
    return sensitivePatterns.reduce(
      (result, pattern) => result.replace(pattern, "[REDACTED]"),
      value
    );
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /token|secret|password|authorization|api.?key/i.test(key)
          ? "[REDACTED]"
          : redact(item),
      ])
    );
  }

  return value;
}
