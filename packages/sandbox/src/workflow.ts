/**
 * AI Workbench - End-to-End Patch & Sandbox Execution Workflow
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { SandboxHandle, sandboxScheduler } from "./scheduler";
import { GitHubBranch } from "../../github/src/branches";
import { githubAdapter } from "../../github/src/adapter";
import { validatePatch, applyPatch } from "../../repository/src/patch";
import { detectTestCommands } from "../../test-runner/src/commands";
import { runTests } from "../../test-runner/src/runner";
import { TestRunResult } from "../../test-runner/src/reports";
import { Artifact } from "../../artifacts/src/store";

export interface PatchWorkflowInput {
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId: string;
  repositoryId: string;
  branchName: string;
  baseSha: string;
  patch: string;
  patchHash: string;
  cancellationEpoch: number;
}

export interface PatchWorkflowResult {
  branch: GitHubBranch;
  diff: string;
  tests: TestRunResult;
  artifacts: Artifact[];
  readyForCommit: boolean;
}

export async function executePatchWorkflow(
  input: PatchWorkflowInput,
  options?: {
    testFailOverride?: boolean;
  }
): Promise<PatchWorkflowResult> {
  // 1. Static patch verification
  validatePatch(input.patch);

  // 2. Branch creation or reuse via GitHub adapter (Idempotent)
  const branch = await githubAdapter.createBranch({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    runId: input.runId,
    repositoryId: input.repositoryId,
    branchName: input.branchName,
    baseSha: input.baseSha,
  });

  // 3. Provision sandbox environment with immutable profile
  const sandbox = await sandboxScheduler.provision({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    runId: input.runId,
    stepId: input.stepId,
    taskType: "patch",
    repositoryId: input.repositoryId,
    commitSha: input.baseSha,
    networkRequired: false,
    requestedHosts: [],
    cancellationEpoch: input.cancellationEpoch,
  });

  try {
    // 4. Apply patch safely within isolated workspace
    const patchResult = await applyPatch(
      {
        repositoryId: input.repositoryId,
        baseSha: input.baseSha,
        branchName: input.branchName,
        patch: input.patch,
        patchHash: input.patchHash,
        runId: input.runId,
        stepId: input.stepId,
      },
      sandbox
    );

    // Simulated test failure hook for test verification
    if (options?.testFailOverride) {
      throw new Error("TEST_FAILED: Unit tests failed during sandbox test execution");
    }

    // 5. Detect and execute project tests
    const testCommands = detectTestCommands({ packageManager: "pnpm" });
    const tests = await runTests(sandbox, testCommands, sandboxScheduler);

    // 6. Collect sanitized artifacts
    const artifacts = await sandboxScheduler.collectArtifacts(sandbox);

    return {
      branch,
      diff: patchResult.diff,
      tests,
      artifacts,
      readyForCommit: tests.passed,
    };
  } finally {
    // 7. Guaranteed destruction of sandbox environment and credential cleanup
    await sandboxScheduler.destroy(sandbox);
  }
}
