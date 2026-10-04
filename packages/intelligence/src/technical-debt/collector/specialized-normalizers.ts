import { Evidence } from "../contracts/evidence";
import { ToolOutputEnvelope } from "./types";
import { digestJson, deterministicEvidenceId } from "./digest";
import { stableStringify } from "./canonical-json";

function parseJson(stdout: string, code: string): any {
  try { return JSON.parse(stdout); } catch { throw new Error(code); }
}

function makeRecord(
  envelope: ToolOutputEnvelope,
  type: Evidence["type"],
  source: string,
  path: string | undefined,
  data: Record<string, unknown>,
  lineStart?: number,
  lineEnd?: number,
): Evidence {
  const payload = {
    type,
    source,
    tenantId: envelope.source.tenantId,
    workspaceId: envelope.source.workspaceId,
    repositoryId: envelope.source.repositoryId,
    commitSha: envelope.source.commitSha,
    path,
    lineStart,
    lineEnd,
    data,
  };
  const contentDigest = digestJson(payload);
  return {
    id: deterministicEvidenceId({
      tenantId: envelope.source.tenantId,
      workspaceId: envelope.source.workspaceId,
      repositoryId: envelope.source.repositoryId,
      commitSha: envelope.source.commitSha,
      evidenceType: type,
      source,
      path,
      lineStart,
      lineEnd,
      contentDigest,
    }),
    type,
    tenantId: envelope.source.tenantId,
    workspaceId: envelope.source.workspaceId,
    repositoryId: envelope.source.repositoryId,
    commitSha: envelope.source.commitSha,
    source,
    path,
    lineStart,
    lineEnd,
    collectedAt: new Date().toISOString(),
    contentDigest,
    data,
  };
}

function assertBase(envelope: ToolOutputEnvelope): void {
  if (!/^[0-9a-f]{7,64}$/.test(envelope.source.commitSha)) {
    throw new Error("TDI_SOURCE_COMMIT_INVALID");
  }
  if (!envelope.invocation.toolId.trim() || !envelope.invocation.version.trim()) {
    throw new Error("TDI_TOOL_PROVENANCE_REQUIRED");
  }
}

function safeObject(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function flattenKnip(report: any): any[] {
  if (Array.isArray(report)) return report;
  const keys = ["files", "dependencies", "devDependencies", "unlisted", "binaries", "exports", "types", "duplicates", "unresolved"];
  const result: any[] = [];
  for (const key of keys) {
    const list = Array.isArray(report?.[key]) ? report[key] : [];
    for (const item of list) result.push({ kind: key, ...safeObject(item) });
  }
  return result;
}

export function normalizeDependencyCruiserJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertBase(envelope);
  const report = parseJson(envelope.stdout, "TDI_DEPCRUISE_JSON_INVALID");
  const violations = Array.isArray(report?.violations) ? report.violations : [];
  return violations.map((v: any) => makeRecord(
    envelope,
    "architecture",
    "tool:dependency-cruiser",
    typeof v?.from === "string" ? v.from : undefined,
    {
      tool: "dependency-cruiser",
      toolVersion: envelope.invocation.version,
      ruleId: v?.rule?.name ?? "unknown",
      severity: String(v?.rule?.severity ?? "error"),
      message: String(v?.rule?.comment ?? v?.rule?.name ?? "dependency rule violation"),
      to: v?.to ?? null,
      circular: Boolean(v?.circular),
      configDigest: envelope.invocation.configDigest,
    },
  ));
}

export function normalizeKnipJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertBase(envelope);
  const issues = flattenKnip(parseJson(envelope.stdout, "TDI_KNIP_JSON_INVALID"));
  return issues.map((issue: any) => makeRecord(
    envelope,
    "static_analysis",
    "tool:knip",
    typeof issue?.file === "string" ? issue.file : (typeof issue?.path === "string" ? issue.path : undefined),
    {
      tool: "knip",
      toolVersion: envelope.invocation.version,
      kind: issue?.kind ?? "unknown",
      name: issue?.name ?? null,
      ...safeObject(issue),
    },
    Number.isInteger(issue?.line) ? issue.line : undefined,
    Number.isInteger(issue?.endLine) ? issue.endLine : undefined,
  ));
}

export function normalizeScorecardJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertBase(envelope);
  const report = parseJson(envelope.stdout, "TDI_SCORECARD_JSON_INVALID");
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  return checks.map((check: any) => makeRecord(
    envelope,
    "security",
    "tool:scorecard",
    undefined,
    {
      tool: "scorecard",
      toolVersion: envelope.invocation.version,
      checkId: check?.key ?? check?.name ?? "unknown",
      score: check?.score ?? null,
      reason: check?.reason ?? "",
      details: check?.details ?? [],
    },
  ));
}

export function normalizeSyftJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertBase(envelope);
  const report = parseJson(envelope.stdout, "TDI_SYFT_JSON_INVALID");
  const packages = Array.isArray(report?.packages) ? report.packages : [];
  return packages.map((pkg: any) => makeRecord(
    envelope,
    "dependency",
    "tool:syft",
    undefined,
    {
      tool: "syft",
      toolVersion: envelope.invocation.version,
      packageId: pkg?.packageId ?? null,
      name: pkg?.name ?? "",
      version: pkg?.version ?? "",
      type: pkg?.type ?? "",
      purl: pkg?.purl ?? null,
      licenses: pkg?.licenses ?? [],
      language: pkg?.language ?? null,
    },
  ));
}

function redactSecretRecord(value: any): Record<string, unknown> {
  const input = safeObject(value);
  return {
    tool: "gitleaks",
    ruleId: input.RuleID ?? input.ruleID ?? input.rule ?? null,
    description: input.Description ?? input.description ?? null,
    file: input.File ?? input.file ?? null,
    line: input.StartLine ?? input.startLine ?? input.Line ?? input.line ?? null,
    commit: input.Commit ?? input.commit ?? null,
    author: input.Author ?? input.author ?? null,
    tags: input.Tags ?? input.tags ?? [],
    redacted: true,
  };
}

export function normalizeGitleaksJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertBase(envelope);
  const report = parseJson(envelope.stdout, "TDI_GITLEAKS_JSON_INVALID");
  if (!Array.isArray(report)) throw new Error("TDI_GITLEAKS_JSON_SHAPE_INVALID");
  return report.map((entry: any) => {
    const safe = redactSecretRecord(entry);
    const path = typeof safe.file === "string" ? safe.file : undefined;
    const line = typeof safe.line === "number" && Number.isInteger(safe.line) ? safe.line : undefined;
    return makeRecord(envelope, "security", "tool:gitleaks", path, {
      toolVersion: envelope.invocation.version,
      ...safe,
    }, line);
  });
}

export function canonicalToolOutputDigest(envelope: ToolOutputEnvelope): string {
  return digestJson({
    toolId: envelope.invocation.toolId,
    toolVersion: envelope.invocation.version,
    args: envelope.invocation.args,
    outputFormat: envelope.invocation.outputFormat,
    configDigest: envelope.invocation.configDigest,
    ruleSet: envelope.invocation.ruleSet ?? null,
    databaseVersion: envelope.invocation.databaseVersion ?? null,
    source: envelope.source,
    stdout: envelope.stdout,
    stderr: envelope.stderr ?? "",
    exitCode: envelope.exitCode,
  });
}
