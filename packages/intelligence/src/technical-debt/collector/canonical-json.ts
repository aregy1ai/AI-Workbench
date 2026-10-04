/** Deterministic canonical JSON used for TDI evidence hashing. */

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export function stableStringify(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("CANONICAL_JSON_NON_FINITE_NUMBER");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return (
      "{" +
      keys
        .map((key) => {
          const item = record[key];
          if (item === undefined) {
            throw new Error("CANONICAL_JSON_UNDEFINED_VALUE");
          }
          return JSON.stringify(key) + ":" + stableStringify(item);
        })
        .join(",") +
      "}"
    );
  }

  throw new Error("CANONICAL_JSON_UNSUPPORTED_VALUE");
}
