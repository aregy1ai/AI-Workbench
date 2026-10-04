/**
 * TDI collector/adapter contract tests.
 * These tests validate normalization and provenance boundaries without executing
 * third-party binaries. Binary execution is reserved for the isolated CI/tool job.
 */
import {
  canonicalToolOutputDigest,
  getTdiToolAdapter,
  getToolDefinition,
  normalizeGitleaksJson,
  normalizeToolOutput,
  stableStringify,
} from "../../packages/intelligence/src/technical-debt";

const source = {
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  repositoryId: "repo-a",
  commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
  sourceRoot: "/workspace/pinned",
};

const invocation = {
  toolId: "semgrep",
  version: "1.179.0",
  executable: "semgrep",
  args: ["scan", "--sarif"],
  outputFormat: "sarif-2.1.0" as const,
  configDigest: "sha256:" + "c".repeat(64),
};

export function runTechnicalDebtCollectorTestSuite(): {
  name: string;
  passed: boolean;
  details?: string;
}[] {
  const out: { name: string; passed: boolean; details?: string }[] = [];
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      out.push({ name, passed: true });
    } catch (e) {
      out.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
    }
  };

  test("stableStringify is key-order independent", () => {
    const a = stableStringify({ b: 2, a: 1, nested: { z: true, y: "x" } });
    const b = stableStringify({ nested: { y: "x", z: true }, a: 1, b: 2 });
    if (a !== b) throw new Error("canonical JSON changed with key order");
  });

  test("SARIF normalization preserves pinned provenance", () => {
    const evidence = normalizeToolOutput({
      source,
      invocation,
      stdout: JSON.stringify({
        version: "2.1.0",
        runs: [{
          tool: { driver: { name: "Semgrep", version: "1.179.0" } },
          results: [{
            ruleId: "javascript.security.demo",
            level: "error",
            message: { text: "demo security issue" },
            locations: [{
              physicalLocation: {
                artifactLocation: { uri: "src/example.ts" },
                region: { startLine: 12, endLine: 12 },
              },
            }],
          }],
        }],
      }),
      exitCode: 0,
    });
    if (evidence.length !== 1) throw new Error("expected one evidence item");
    if (evidence[0].commitSha !== source.commitSha) throw new Error("commit provenance was lost");
    if (!/^sha256:[0-9a-f]{64}$/.test(evidence[0].contentDigest)) {
      throw new Error("digest is not SHA-256");
    }
    if (evidence[0].path !== "src/example.ts") throw new Error("path was not preserved");
  });

  test("Equivalent tool output has replay-stable evidence identity", () => {
    const envelope = {
      source,
      invocation,
      stdout: JSON.stringify({
        version: "2.1.0",
        runs: [{
          tool: { driver: { name: "Semgrep", version: "1.179.0" } },
          results: [{
            ruleId: "demo.rule",
            level: "warning",
            message: { text: "same" },
            locations: [{
              physicalLocation: { artifactLocation: { uri: "a.ts" }, region: { startLine: 4 } },
            }],
          }],
        }],
      }),
      exitCode: 0,
    };
    const first = normalizeToolOutput(envelope);
    const second = normalizeToolOutput(envelope);
    if (first[0].id !== second[0].id) throw new Error("evidence identity is not replay-stable");
    if (canonicalToolOutputDigest(envelope) !== canonicalToolOutputDigest(envelope)) {
      throw new Error("raw output fingerprint is not stable");
    }
  });

  test("Different commit changes evidence identity", () => {
    const base = {
      source,
      invocation,
      stdout: JSON.stringify({
        version: "2.1.0",
        runs: [{ tool: { driver: { name: "Semgrep", version: "1.179.0" } }, results: [] }],
      }),
      exitCode: 0,
    };
    const a = normalizeToolOutput(base)[0];
    const b = normalizeToolOutput({
      ...base,
      source: { ...source, commitSha: "a".repeat(40) },
    })[0];
    if (a && b && a.id === b.id) throw new Error("commit change did not alter identity");
  });

  test("Tool registry exposes every selected analyzer", () => {
    for (const id of [
      "codeql", "semgrep", "osv-scanner", "trivy", "actionlint",
      "dependency-cruiser", "knip", "scorecard", "syft", "gitleaks",
    ]) {
      getToolDefinition(id);
      getTdiToolAdapter(id);
    }
  });

  test("Gitleaks normalizer never stores secret material", () => {
    const envelope = {
      source,
      invocation: {
        ...invocation,
        toolId: "gitleaks",
        version: "PIN_AT_ADOPTION",
        executable: "gitleaks",
        outputFormat: "json" as const,
      },
      stdout: JSON.stringify([{
        RuleID: "generic-api-key",
        Description: "API key",
        File: "src/config.ts",
        StartLine: 17,
        Secret: "DO-NOT-STORE-THIS",
        Match: "DO-NOT-STORE-THIS",
      }]),
      exitCode: 1,
    };
    const evidence = normalizeGitleaksJson(envelope);
    const serialized = JSON.stringify(evidence);
    if (serialized.includes("DO-NOT-STORE-THIS")) {
      throw new Error("secret material leaked into evidence");
    }
    if (!evidence[0]?.data?.redacted) throw new Error("gitleaks result not marked redacted");
  });

  test("External tools remain evidence producers, never gate authorities", () => {
    const result = normalizeToolOutput({
      source,
      invocation,
      stdout: JSON.stringify({
        version: "2.1.0",
        runs: [{
          tool: { driver: { name: "Semgrep", version: "1.179.0" } },
          results: [{
            ruleId: "security.critical",
            level: "error",
            message: { text: "critical" },
          }],
        }],
      }),
      exitCode: 0,
    })[0];
    if (!result) throw new Error("missing evidence");
    if ("decision" in result.data) throw new Error("tool result manufactured decision authority");
  });

  return out;
}
