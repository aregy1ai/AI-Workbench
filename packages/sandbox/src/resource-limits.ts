/**
 * AI Workbench - Sandbox Resource Limits & Safety Thresholds
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export const RESOURCE_LIMITS = {
  MAX_CPU_CORES: 4,
  MAX_MEMORY_MB: 8192,
  MAX_PIDS: 512,
  MAX_TIMEOUT_MS: 20 * 60_000, // 20 minutes
  MAX_OUTPUT_BYTES: 100 * 1024 * 1024, // 100 MiB
  MAX_ARTIFACT_BYTES: 500 * 1024 * 1024, // 500 MiB
};

export const ALLOWED_EXECUTABLES = new Set([
  "git",
  "node",
  "npm",
  "pnpm",
  "yarn",
  "pytest",
  "go",
  "cargo",
  "mvn",
]);

export interface SandboxCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
}

export function validateCommand(command: SandboxCommand): void {
  if (!ALLOWED_EXECUTABLES.has(command.executable)) {
    throw new Error("EXECUTABLE_NOT_ALLOWED");
  }

  if (command.timeoutMs > RESOURCE_LIMITS.MAX_TIMEOUT_MS) {
    throw new Error("COMMAND_TIMEOUT_TOO_LARGE");
  }

  if (command.maxOutputBytes > RESOURCE_LIMITS.MAX_OUTPUT_BYTES) {
    throw new Error("COMMAND_OUTPUT_TOO_LARGE");
  }
}
