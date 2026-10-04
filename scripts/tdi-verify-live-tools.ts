import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeActionlintJson,
  normalizeDependencyCruiserJson,
  normalizeGitleaksJson,
  normalizeKnipJson,
  normalizeOsvSarif,
  normalizeSarif,
  normalizeScorecardJson,
  normalizeSyftJson,
  normalizeTrivySarif,
  getToolDefinition,
} from "../packages/intelligence/src/technical-debt";

const root = "tdi-live-results";
const commitSha = process.env.GITHUB_SHA ?? "unknown";
const sourceRoot = process.cwd();

const source = {
  tenantId: process.env.TDI_TENANT_ID ?? "ci-tenant",
  workspaceId: process.env.TDI_WORKSPACE_ID ?? "ci-workspace",
  repositoryId: process.env.GITHUB_REPOSITORY ?? "aregy1ai/AI-Workbench",
  commitSha,
  sourceRoot,
};

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  const output: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) output.push(...filesUnder(full));
    else output.push(full);
  }
  return output;
}

function firstMatching(...paths: string[]): string | undefined {
  return paths.find(existsSync);
}

function envelope(toolId: string, stdout: string, format: any) {
  const definition = getToolDefinition(toolId);
  return {
    source,
    invocation: {
      toolId,
      version: definition.version,
      executable: definition.executable,
      args: [],
      outputFormat: format,
      configDigest: process.env["TDI_" + toolId.toUpperCase().replace(/-/g, "_") + "_CONFIG_DIGEST"]
        ?? "sha256:" + "0".repeat(64),
    },
    stdout,
    exitCode: 0,
    rawOutputDigest: undefined,
    executionEnvelopeDigest: undefined,
  };
}

type Summary = {
  tool: string;
  version: string;
  files: string[];
  evidenceCount: number;
  evidenceDigests: string[];
};

const summaries: Summary[] = [];

function record(tool: string, files: string[], evidence: { contentDigest: string }[]) {
  summaries.push({
    tool,
    version: getToolDefinition(tool).version,
    files,
    evidenceCount: evidence.length,
    evidenceDigests: evidence.map((x) => x.contentDigest),
  });
}

const codeqlSarif = filesUnder(join(root, "codeql")).find((p) => p.endsWith(".sarif"));
if (!codeqlSarif) throw new Error("TDI_LIVE_CODEQL_SARIF_MISSING");
record("codeql", [codeqlSarif], normalizeSarif(
  envelope("codeql", readFileSync(codeqlSarif, "utf8"), "sarif-2.1.0"),
  "security",
));

const semgrep = join(root, "semgrep.sarif");
if (!existsSync(semgrep)) throw new Error("TDI_LIVE_SEMGREP_SARIF_MISSING");
record("semgrep", [semgrep], normalizeSarif(
  envelope("semgrep", readFileSync(semgrep, "utf8"), "sarif-2.1.0"),
  "static_analysis",
));

const osv = join(root, "osv.sarif");
if (!existsSync(osv)) throw new Error("TDI_LIVE_OSV_SARIF_MISSING");
record("osv-scanner", [osv], normalizeOsvSarif(
  envelope("osv-scanner", readFileSync(osv, "utf8"), "sarif-2.1.0"),
));

const trivy = join(root, "trivy.sarif");
if (!existsSync(trivy)) throw new Error("TDI_LIVE_TRIVY_SARIF_MISSING");
record("trivy", [trivy], normalizeTrivySarif(
  envelope("trivy", readFileSync(trivy, "utf8"), "sarif-2.1.0"),
));

const actionlint = join(root, "actionlint.json");
if (!existsSync(actionlint)) throw new Error("TDI_LIVE_ACTIONLINT_JSON_MISSING");
record("actionlint", [actionlint], normalizeActionlintJson(
  envelope("actionlint", readFileSync(actionlint, "utf8") || "[]", "json"),
));

const depcruise = join(root, "dependency-cruiser.json");
if (!existsSync(depcruise)) throw new Error("TDI_LIVE_DEPENDENCY_CRUISER_JSON_MISSING");
record("dependency-cruiser", [depcruise], normalizeDependencyCruiserJson(
  envelope("dependency-cruiser", readFileSync(depcruise, "utf8"), "json"),
));

const knip = join(root, "knip.json");
if (!existsSync(knip)) throw new Error("TDI_LIVE_KNIP_JSON_MISSING");
record("knip", [knip], normalizeKnipJson(
  envelope("knip", readFileSync(knip, "utf8"), "json"),
));

const scorecard = join(root, "scorecard.json");
if (!existsSync(scorecard)) throw new Error("TDI_LIVE_SCORECARD_JSON_MISSING");
record("scorecard", [scorecard], normalizeScorecardJson(
  envelope("scorecard", readFileSync(scorecard, "utf8"), "json"),
));

const syft = join(root, "syft.json");
if (!existsSync(syft)) throw new Error("TDI_LIVE_SYFT_JSON_MISSING");
record("syft", [syft], normalizeSyftJson(
  envelope("syft", readFileSync(syft, "utf8"), "spdx-2.3"),
));

const gitleaks = join(root, "gitleaks.json");
if (!existsSync(gitleaks)) throw new Error("TDI_LIVE_GITLEAKS_JSON_MISSING");
const gitleaksEvidence = normalizeGitleaksJson(
  envelope("gitleaks", readFileSync(gitleaks, "utf8") || "[]", "json"),
);
const serialized = JSON.stringify(gitleaksEvidence);
if (/\b(Secret|Match)\b/.test(serialized)) {
  throw new Error("TDI_LIVE_GITLEAKS_SECRET_FIELDS_PRESENT");
}
record("gitleaks", [gitleaks], gitleaksEvidence);

writeFileSync(
  join(root, "normalized-summary.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source,
    tools: summaries,
  }, null, 2) + "\n",
  "utf8",
);

console.log(JSON.stringify(summaries, null, 2));
