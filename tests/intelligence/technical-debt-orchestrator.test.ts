import { TdiScanOrchestrator } from "../../packages/intelligence/src/technical-debt";

export async function runTechnicalDebtOrchestratorTestSuite(): Promise<{
  name: string;
  passed: boolean;
  details?: string;
}[]> {
  const results: { name: string; passed: boolean; details?: string }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({
        name,
        passed: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const source = {
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    repositoryId: "repo-a",
    commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
    sourceRoot: "/workspace/pinned",
  };

  await test("orchestrator executes registered tools through the executor boundary", async () => {
    const calls: string[] = [];
    const executor = {
      async execute(input: {
        executable: string;
        args: string[];
        cwd: string;
        env: Record<string, string>;
        timeoutMs: number;
        maxOutputBytes: number;
      }) {
        calls.push(input.executable);
        if (input.executable === "actionlint") {
          return {
            exitCode: 0,
            stdout: "[]",
            stderr: "",
            durationMs: 3,
          };
        }
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            version: "2.1.0",
            runs: [{
              tool: { driver: { name: "Semgrep", version: "1.179.0" } },
              results: [],
            }],
          }),
          stderr: "",
          durationMs: 4,
        };
      },
      async readTextFile() {
        return JSON.stringify({
          version: "2.1.0",
          runs: [{
            tool: { driver: { name: "Semgrep", version: "1.179.0" } },
            results: [],
          }],
        });
      },
    };

    const orchestrator = new TdiScanOrchestrator(executor);
    const result = await orchestrator.scan({
      source,
      toolIds: ["semgrep"],
      timeoutMs: 60_000,
      maxOutputBytes: 1024 * 1024,
      configDigestByTool: { semgrep: "sha256:" + "1".repeat(64) },
    });

    if (calls.join(",") !== "semgrep") throw new Error("tool did not execute through executor");
    if (result.tools.length !== 1 || !result.tools[0].success) throw new Error("tool run not successful");
    if (!/^sha256:[0-9a-f]{64}$/.test(result.tools[0].rawOutputDigest ?? "")) {
      throw new Error("raw output digest is invalid");
    }
  });

  await test("orchestrator reads file outputs through the executor boundary", async () => {
    const calls: string[] = [];
    const executor = {
      async execute(input: {
        executable: string;
        args: string[];
        cwd: string;
        env: Record<string, string>;
        timeoutMs: number;
        maxOutputBytes: number;
      }) {
        calls.push(input.executable);
        return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
      },
      async readTextFile(path: string) {
        if (!path.endsWith("osv-scanner.out")) throw new Error("unexpected report path");
        return JSON.stringify({ version: "2.1.0", runs: [] });
      },
    };

    const orchestrator = new TdiScanOrchestrator(executor);
    const result = await orchestrator.scan({
      source,
      toolIds: ["osv-scanner"],
      timeoutMs: 60_000,
      maxOutputBytes: 1024 * 1024,
    });

    if (calls[0] !== "osv-scanner") throw new Error("OSV was not executed");
    if (!result.tools[0].success) throw new Error("file-output tool failed");
  });

  await test("tool failures produce no evidence", async () => {
    const executor = {
      async execute() {
        return {
          exitCode: 42,
          stdout: "",
          stderr: "tool failure",
          durationMs: 1,
        };
      },
      async readTextFile() {
        throw new Error("read must not occur after failed command");
      },
    };

    const orchestrator = new TdiScanOrchestrator(executor);
    const result = await orchestrator.scan({
      source,
      toolIds: ["semgrep"],
      timeoutMs: 60_000,
      maxOutputBytes: 1024 * 1024,
    });

    if (result.tools[0].success) throw new Error("failed tool marked successful");
    if (result.evidence.length !== 0) throw new Error("failed tool emitted evidence");
    if (result.tools[0].failureReason !== "TOOL_EXIT_42") throw new Error("wrong failure reason");
  });

  await test("unknown tools are rejected by the registry", async () => {
    const executor = {
      async execute() {
        throw new Error("must not execute");
      },
      async readTextFile() {
        throw new Error("must not read");
      },
    };

    const orchestrator = new TdiScanOrchestrator(executor);
    try {
      await orchestrator.scan({
        source,
        toolIds: ["does-not-exist"],
      });
      throw new Error("unknown tool accepted");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("TDI_TOOL_NOT_REGISTERED:")) {
        throw error;
      }
    }
  });

  return results;
}
