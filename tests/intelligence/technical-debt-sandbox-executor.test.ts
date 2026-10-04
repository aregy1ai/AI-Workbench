import { TdiSandboxExecutor } from "../../packages/intelligence/src/technical-debt";
import { SandboxHandle } from "../../packages/sandbox/src/cleanup";

function sandbox(overrides: Partial<SandboxHandle> = {}): SandboxHandle {
  return {
    sessionId: "session-a",
    runtime: "gvisor",
    containerId: "container-a",
    profile: {} as any,
    workspacePath: "/workspace/pinned",
    cancellationEpoch: 0,
    runId: "run-a",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    ...overrides,
  };
}

export async function runTechnicalDebtSandboxExecutorSuite(): Promise<{
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
      results.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
    }
  };

  await test("sandbox executor rejects source-root mismatch", async () => {
    const executor = new TdiSandboxExecutor(sandbox());
    try {
      await executor.execute({
        source: {
          tenantId: "tenant-a",
          workspaceId: "workspace-a",
          repositoryId: "repo-a",
          commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
          sourceRoot: "/workspace/other",
        },
        executable: "semgrep",
        args: [],
        cwd: "/workspace/other",
        env: {},
        timeoutMs: 1000,
        maxOutputBytes: 1024,
      });
      throw new Error("source-root mismatch accepted");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "TDI_EXECUTION_SOURCE_SCOPE_MISMATCH") {
        throw error;
      }
    }
  });

  await test("sandbox executor rejects tenant mismatch", async () => {
    const executor = new TdiSandboxExecutor(sandbox());
    try {
      await executor.execute({
        source: {
          tenantId: "tenant-b",
          workspaceId: "workspace-a",
          repositoryId: "repo-a",
          commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
          sourceRoot: "/workspace/pinned",
        },
        executable: "semgrep",
        args: [],
        cwd: "/workspace/pinned",
        env: {},
        timeoutMs: 1000,
        maxOutputBytes: 1024,
      });
      throw new Error("tenant mismatch accepted");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "TDI_EXECUTION_SOURCE_SCOPE_MISMATCH") {
        throw error;
      }
    }
  });

  return results;
}
