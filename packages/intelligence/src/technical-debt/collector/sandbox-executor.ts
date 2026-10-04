import { SandboxHandle } from "../../../sandbox/src/cleanup";
import { runtime } from "../../../sandbox/src/runtime";
import { RESOURCE_LIMITS } from "../../../sandbox/src/resource-limits";
import { TdiCommandResult, TdiToolExecutor } from "./orchestrator";

export class TdiSandboxExecutor implements TdiToolExecutor {
  constructor(private readonly sandbox: SandboxHandle) {}

  public async execute(input: {
    source: { tenantId: string; workspaceId: string; repositoryId: string; commitSha: string; sourceRoot: string };
    executable: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<TdiCommandResult> {
    if (
      input.source.sourceRoot !== this.sandbox.workspacePath ||
      (this.sandbox.tenantId && this.sandbox.tenantId !== input.source.tenantId) ||
      (this.sandbox.workspaceId && this.sandbox.workspaceId !== input.source.workspaceId)
    ) {
      throw new Error("TDI_EXECUTION_SOURCE_SCOPE_MISMATCH");
    }

    if (input.cwd !== this.sandbox.workspacePath) {
      throw new Error("TDI_EXECUTION_CWD_OUTSIDE_SANDBOX");
    }

    if (input.timeoutMs > RESOURCE_LIMITS.MAX_TIMEOUT_MS) {
      throw new Error("TDI_EXECUTION_TIMEOUT_EXCEEDS_SANDBOX_LIMIT");
    }

    if (input.maxOutputBytes > RESOURCE_LIMITS.MAX_OUTPUT_BYTES) {
      throw new Error("TDI_EXECUTION_OUTPUT_EXCEEDS_SANDBOX_LIMIT");
    }

    const result = await runtime.execute(this.sandbox.containerId, {
      executable: input.executable,
      args: [...input.args],
      cwd: input.cwd,
      env: { ...input.env },
      timeoutMs: input.timeoutMs,
      maxOutputBytes: input.maxOutputBytes,
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
    };
  }

  public async readTextFile(path: string, maxBytes: number): Promise<string> {
    const prefix = this.sandbox.workspacePath.replace(/\/$/, "");
    if (!path.startsWith(prefix + "/") && path !== prefix) {
      throw new Error("TDI_ARTIFACT_PATH_OUTSIDE_SANDBOX");
    }

    return runtime.readFile(
      this.sandbox.containerId,
      path.slice(prefix.length).replace(/^\//, "") || ".",
      Math.min(maxBytes, RESOURCE_LIMITS.MAX_OUTPUT_BYTES),
    );
  }
}
