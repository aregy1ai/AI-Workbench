import { ToolDefinition } from "./types";

export const TDI_TOOLCHAIN: readonly ToolDefinition[] = [
  {
    id: "codeql",
    tier: "A",
    version: "2.27.1",
    outputFormat: "sarif-2.1.0",
    purpose: "Semantic static security analysis",
    executable: "codeql",
    licenseNote:
      "Automated CI/CD use is subject to GitHub CodeQL licensing/plan terms; enable only when permitted.",
    buildCommands: (root, outputFile) => {
      const database = outputFile + ".codeql-db";
      return [
        {
          executable: "codeql",
          args: ["database", "create", database, "--language=javascript-typescript", "--source-root=" + root],
          outputTarget: "stdout",
        },
        {
          executable: "codeql",
          args: ["database", "analyze", database, "--format=sarifv2.1.0", "--output=" + outputFile],
          outputTarget: "file",
        },
      ];
    },
  },
  {
    id: "semgrep",
    tier: "A",
    version: "1.179.0",
    outputFormat: "sarif-2.1.0",
    purpose: "Pattern-based security, correctness and maintainability analysis",
    executable: "semgrep",
    buildCommands: (root, outputFile) => [{
      executable: "semgrep",
      args: ["scan", "--sarif", "--output", outputFile, "--config", "auto", root],
      outputTarget: "file",
    }],
  },
  {
    id: "osv-scanner",
    tier: "A",
    version: "2.6.0",
    outputFormat: "sarif-2.1.0",
    purpose: "Dependency vulnerability evidence",
    executable: "osv-scanner",
    buildCommands: (root, outputFile) => [{
      executable: "osv-scanner",
      args: ["scan", "--format", "sarif", "--output", outputFile, root],
      outputTarget: "file",
    }],
  },
  {
    id: "trivy",
    tier: "A",
    version: "0.74.0",
    outputFormat: "sarif-2.1.0",
    purpose: "Vulnerability, misconfiguration, secret and supply-chain scanning",
    executable: "trivy",
    buildCommands: (root, outputFile) => [{
      executable: "trivy",
      args: ["fs", "--format", "sarif", "--output", outputFile, root],
      outputTarget: "file",
    }],
  },
  {
    id: "actionlint",
    tier: "A",
    version: "1.7.12",
    outputFormat: "json",
    purpose: "GitHub Actions workflow validation",
    executable: "actionlint",
    buildCommands: (root) => [{
      executable: "actionlint",
      args: ["-format", "{{json .}}", root],
      outputTarget: "stdout",
    }],
  },
  {
    id: "dependency-cruiser",
    tier: "A",
    version: "18.1.0",
    outputFormat: "json",
    purpose: "Architecture dependency graph and rule violations",
    executable: "depcruise",
    buildCommands: (root) => [{
      executable: "depcruise",
      args: [root, "--output-type", "json"],
      outputTarget: "stdout",
    }],
  },
  {
    id: "knip",
    tier: "A",
    version: "6.31.0",
    outputFormat: "json",
    purpose: "Dead code, unused exports and dependencies",
    executable: "knip",
    buildCommands: () => [{
      executable: "knip",
      args: ["--reporter", "json"],
      outputTarget: "stdout",
    }],
  },
  {
    id: "scorecard",
    tier: "B",
    version: "5.5.0",
    outputFormat: "json",
    purpose: "Repository and supply-chain security posture",
    executable: "scorecard",
    buildCommands: () => [{
      executable: "scorecard",
      args: ["--format", "json"],
      outputTarget: "stdout",
    }],
  },
  {
    id: "syft",
    tier: "B",
    version: "1.54.0",
    outputFormat: "spdx-2.3",
    purpose: "SBOM generation",
    executable: "syft",
    buildCommands: (root) => [{
      executable: "syft",
      args: [root, "-o", "spdx-json"],
      outputTarget: "stdout",
    }],
  },
  {
    id: "gitleaks",
    tier: "B",
    version: "PIN_AT_ADOPTION",
    outputFormat: "json",
    purpose: "Secret detection including history-aware scans",
    executable: "gitleaks",
    buildCommands: (root, outputFile) => [{
      executable: "gitleaks",
      args: ["detect", "--source", root, "--report-format", "json", "--report-path", outputFile, "--redact"],
      outputTarget: "file",
    }],
  },
] as const;

export function getToolDefinition(toolId: string): ToolDefinition {
  const definition = TDI_TOOLCHAIN.find((tool) => tool.id === toolId);
  if (!definition) throw new Error("TDI_TOOL_NOT_REGISTERED:" + toolId);
  return definition;
}
