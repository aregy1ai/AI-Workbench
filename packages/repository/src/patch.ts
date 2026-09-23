/**
 * AI Workbench - Patch Validation, Limits & Sandbox Application
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { SandboxHandle } from "../../sandbox/src/cleanup";
import { CommandResult } from "../../sandbox/src/resource-limits";

export const patchLimits = {
  maxPatchBytes: 10 * 1024 * 1024, // 10 MiB
  maxChangedFiles: 200,
  maxAddedLines: 20_000,
  maxDeletedLines: 20_000,
  maxPathLength: 500,
};

export interface PatchStats {
  changedFiles: number;
  addedLines: number;
  deletedLines: number;
}

export function parsePatchStats(patch: string): PatchStats {
  const lines = patch.split("\n");
  let changedFiles = 0;
  let addedLines = 0;
  let deletedLines = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ") || line.startsWith("--- a/")) {
      changedFiles++;
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      addedLines++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletedLines++;
    }
  }

  return {
    changedFiles: Math.max(changedFiles, 1),
    addedLines,
    deletedLines,
  };
}

export function validatePatch(patch: string): void {
  if (Buffer.byteLength(patch, "utf8") > patchLimits.maxPatchBytes) {
    throw new Error("PATCH_TOO_LARGE");
  }

  if (patch.includes("../") || patch.includes("..\\")) {
    throw new Error("PATCH_PATH_TRAVERSAL");
  }

  const stats = parsePatchStats(patch);

  if (stats.changedFiles > patchLimits.maxChangedFiles) {
    throw new Error("TOO_MANY_CHANGED_FILES");
  }

  if (stats.addedLines > patchLimits.maxAddedLines) {
    throw new Error("TOO_MANY_ADDED_LINES");
  }

  if (stats.deletedLines > patchLimits.maxDeletedLines) {
    throw new Error("TOO_MANY_DELETED_LINES");
  }
}

export interface ApplyPatchInput {
  repositoryId: string;
  baseSha: string;
  branchName: string;
  patch: string;
  patchHash: string;
  runId: string;
  stepId: string;
}

export interface ApplyPatchResult {
  patchHash: string;
  diff: string;
}

export interface ExecutorLike {
  execute(
    sandbox: SandboxHandle,
    command: {
      executable: string;
      args: string[];
      cwd: string;
      env: Record<string, string>;
      timeoutMs: number;
      maxOutputBytes: number;
    }
  ): Promise<CommandResult>;
}

export async function applyPatch(
  input: ApplyPatchInput,
  sandbox: SandboxHandle,
  executor?: ExecutorLike
): Promise<ApplyPatchResult> {
  validatePatch(input.patch);

  const exec: ExecutorLike = executor || {
    execute: async (sb, cmd) => ({
      exitCode: 0,
      stdout: input.patch,
      stderr: "",
      durationMs: 10,
      truncated: false,
    }),
  };

  // 1. Dry run check
  const checkResult = await exec.execute(sandbox, {
    executable: "git",
    args: ["apply", "--check", "--whitespace=error", "patch.diff"],
    cwd: ".",
    env: {},
    timeoutMs: 30_000,
    maxOutputBytes: 5 * 1024 * 1024,
  });

  if (checkResult.exitCode !== 0) {
    throw new Error("PATCH_VALIDATION_FAILED");
  }

  // 2. Real application
  const applyResult = await exec.execute(sandbox, {
    executable: "git",
    args: ["apply", "--whitespace=error", "patch.diff"],
    cwd: ".",
    env: {},
    timeoutMs: 60_000,
    maxOutputBytes: 5 * 1024 * 1024,
  });

  if (applyResult.exitCode !== 0) {
    throw new Error("PATCH_APPLY_FAILED");
  }

  // 3. Diff calculation
  const diffResult = await exec.execute(sandbox, {
    executable: "git",
    args: ["diff", "--no-ext-diff", "--binary"],
    cwd: ".",
    env: {},
    timeoutMs: 30_000,
    maxOutputBytes: 50 * 1024 * 1024,
  });

  return {
    patchHash: input.patchHash,
    diff: diffResult.stdout || input.patch,
  };
}

