import { validateCommand } from "../../packages/sandbox/src/resource-limits";

export function runSandboxToolAllowlistTestSuite(): {
  name: string;
  passed: boolean;
  details?: string;
}[] {
  const results: { name: string; passed: boolean; details?: string }[] = [];
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({
        name,
        passed: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }
  };

  test("approved TDI analyzers are allowlisted", () => {
    for (const executable of [
      "codeql", "semgrep", "osv-scanner", "trivy", "actionlint",
      "depcruise", "knip", "scorecard", "syft", "gitleaks",
    ]) {
      validateCommand({
        executable,
        args: [],
        cwd: "/workspace/pinned",
        env: { CI: "true" },
        timeoutMs: 60_000,
        maxOutputBytes: 5 * 1024 * 1024,
      });
    }
  });

  test("unknown executable remains blocked", () => {
    try {
      validateCommand({
        executable: "curl",
        args: ["https://example.invalid"],
        cwd: "/workspace/pinned",
        env: {},
        timeoutMs: 60_000,
        maxOutputBytes: 1024,
      });
      throw new Error("unapproved executable was accepted");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "EXECUTABLE_NOT_ALLOWED") {
        throw error;
      }
    }
  });

  test("zero timeout is rejected", () => {
    try {
      validateCommand({
        executable: "semgrep",
        args: [],
        cwd: "/workspace/pinned",
        env: {},
        timeoutMs: 0,
        maxOutputBytes: 1024,
      });
      throw new Error("zero timeout accepted");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "COMMAND_TIMEOUT_INVALID") {
        throw error;
      }
    }
  });

  return results;
}
