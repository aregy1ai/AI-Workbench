import { Evidence, EvidenceType } from "../contracts/evidence";
import { FindingCategory, FindingSeverity } from "../contracts/finding";
import { digestJson, deterministicEvidenceId } from "./digest";
import { PinnedSource, ToolOutputEnvelope } from "./types";

interface NormalizedEvidenceInput {
  type: EvidenceType;
  source: string;
  path?: string;
  lineStart?: number;
  lineEnd?: number;
  data: Record<string, unknown>;
}

function makeEvidence(source: PinnedSource, input: NormalizedEvidenceInput): Evidence {
  const digestPayload = {
    type: input.type,
    source: input.source,
    tenantId: source.tenantId,
    workspaceId: source.workspaceId,
    repositoryId: source.repositoryId,
    commitSha: source.commitSha,
    path: input.path,
    lineStart: input.lineStart,
    lineEnd: input.lineEnd,
    data: input.data,
  };

  const contentDigest = digestJson(digestPayload);

  return {
    id: deterministicEvidenceId({
      tenantId: source.tenantId,
      workspaceId: source.workspaceId,
      repositoryId: source.repositoryId,
      commitSha: source.commitSha,
      evidenceType: input.type,
      source: input.source,
      path: input.path,
      lineStart: input.lineStart,
      lineEnd: input.lineEnd,
      contentDigest,
    }),
    type: input.type,
    tenantId: source.tenantId,
    workspaceId: source.workspaceId,
    repositoryId: source.repositoryId,
    commitSha: source.commitSha,
    source: input.source,
    path: input.path,
    lineStart: input.lineStart,
    lineEnd: input.lineEnd,
    collectedAt: new Date().toISOString(),
    contentDigest,
    data: input.data,
  };
}

function assertEnvelope(envelope: ToolOutputEnvelope): void {
  if (!/^[0-9a-f]{7,64}$/.test(envelope.source.commitSha)) {
    throw new Error("TDI_SOURCE_COMMIT_INVALID");
  }
  if (!envelope.invocation.toolId.trim() || !envelope.invocation.version.trim()) {
    throw new Error("TDI_TOOL_PROVENANCE_REQUIRED");
  }
}

function mapLevel(value: unknown): FindingSeverity {
  const level = String(value ?? "").toLowerCase();
  if (level === "error" || level === "critical") return "critical";
  if (level === "warning" || level === "high") return "high";
  if (level === "note" || level === "medium") return "medium";
  return "low";
}

function mapRuleCategory(rule: string, tool: string): FindingCategory {
  const value = (tool + " " + rule).toLowerCase();
  if (/(security|vuln|cve|ghsa|secret|injection|auth)/.test(value)) return "security";
  if (/(depend|package|lockfile|sbom|license)/.test(value)) return "maintainability";
  if (/(workflow|github|ci)/.test(value)) return "reliability";
  if (/(perf|performance)/.test(value)) return "performance";
  if (/(test|coverage)/.test(value)) return "testing";
  if (/(architecture|dependency|cycle|module)/.test(value)) return "architecture";
  return "maintainability";
}

export function normalizeSarif(
  envelope: ToolOutputEnvelope,
  evidenceType: EvidenceType = "static_analysis",
): Evidence[] {
  assertEnvelope(envelope);

  let document: any;
  try {
    document = JSON.parse(envelope.stdout);
  } catch {
    throw new Error("TDI_SARIF_JSON_INVALID");
  }

  if (document?.version !== "2.1.0" || !Array.isArray(document.runs)) {
    throw new Error("TDI_SARIF_VERSION_INVALID");
  }

  const output: Evidence[] = [];

  for (const run of document.runs) {
    const driver = run?.tool?.driver ?? {};
    const toolName = String(driver.name ?? envelope.invocation.toolId);
    const toolVersion = String(driver.version ?? envelope.invocation.version);

    for (const result of Array.isArray(run.results) ? run.results : []) {
      const location = result?.locations?.[0]?.physicalLocation;
      const artifact = location?.artifactLocation?.uri;
      const startLine = location?.region?.startLine;
      const endLine = location?.region?.endLine;
      const ruleId = String(result?.ruleId ?? "unknown");
      const category = mapRuleCategory(ruleId, toolName);

      output.push(
        makeEvidence(envelope.source, {
          type: evidenceType,
          source: "tool:" + toolName,
          path: typeof artifact === "string" ? artifact : undefined,
          lineStart: Number.isInteger(startLine) ? startLine : undefined,
          lineEnd: Number.isInteger(endLine) ? endLine : undefined,
          data: {
            tool: toolName,
            toolVersion,
            ruleId,
            category,
            severity: mapLevel(result?.level),
            message: result?.message?.text ?? "",
            properties: result?.properties ?? {},
            provenance: {
              tool: toolName,
              toolVersion,
              configDigest: envelope.invocation.configDigest,
              ruleSet: envelope.invocation.ruleSet ?? null,
              databaseVersion: envelope.invocation.databaseVersion ?? null,
              rawOutputDigest: envelope.rawOutputDigest ?? null,
              executionEnvelopeDigest: envelope.executionEnvelopeDigest ?? null,
            },
          },
        }),
      );
    }
  }

  return output;
}

export function normalizeActionlintJson(envelope: ToolOutputEnvelope): Evidence[] {
  assertEnvelope(envelope);

  let errors: any;
  try {
    errors = JSON.parse(envelope.stdout || "[]");
  } catch {
    throw new Error("TDI_ACTIONLINT_JSON_INVALID");
  }

  if (!Array.isArray(errors)) {
    throw new Error("TDI_ACTIONLINT_JSON_SHAPE_INVALID");
  }

  return errors.map((error) =>
    makeEvidence(envelope.source, {
      type: "ci",
      source: "tool:actionlint",
      path: typeof error?.Filepath === "string" ? error.Filepath : undefined,
      lineStart: Number.isInteger(error?.Line) ? error.Line : undefined,
      data: {
        tool: "actionlint",
        toolVersion: envelope.invocation.version,
        kind: String(error?.Kind ?? "workflow"),
        severity: "high",
        message: String(error?.Message ?? ""),
        column: Number.isInteger(error?.Column) ? error.Column : undefined,
        snippet: String(error?.Snippet ?? ""),
      },
    }),
  );
}

export function normalizeOsvSarif(envelope: ToolOutputEnvelope): Evidence[] {
  return normalizeSarif(envelope, "dependency");
}

export function normalizeTrivySarif(envelope: ToolOutputEnvelope): Evidence[] {
  return normalizeSarif(envelope, "security");
}

export function normalizeGenericJsonIssues(
  envelope: ToolOutputEnvelope,
  evidenceType: EvidenceType,
  source: string,
  issues: unknown[],
): Evidence[] {
  assertEnvelope(envelope);

  return issues.map((issue: any) =>
    makeEvidence(envelope.source, {
      type: evidenceType,
      source,
      path: typeof issue?.path === "string" ? issue.path : undefined,
      lineStart: Number.isInteger(issue?.line) ? issue.line : undefined,
      lineEnd: Number.isInteger(issue?.endLine) ? issue.endLine : undefined,
      data: {
        tool: envelope.invocation.toolId,
        toolVersion: envelope.invocation.version,
        issue,
      },
    }),
  );
}
