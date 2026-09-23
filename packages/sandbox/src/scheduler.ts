/**
 * AI Workbench - Sandbox Scheduler & Isolation Lifecycle Engine
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import {
  SandboxProfile,
  mediumProfile,
  profileSelector,
  profileValidator,
  DEFAULT_SANDBOX_PROFILE as BASE_DEFAULT_PROFILE,
} from "./profiles";
import { validateNetworkRequest } from "./network-policy";
import {
  SandboxCommand,
  CommandResult,
  validateCommand,
} from "./resource-limits";
import { runtime, SandboxRuntime, resolveSafePath } from "./runtime";
import {
  SandboxHandle,
  CleanupResult,
  destroySandbox,
} from "./cleanup";
import { warmPoolManager } from "./warm-pool";
import { snapshotService } from "../../repository/src/snapshot";
import {
  applyPatch,
  ApplyPatchInput,
  validatePatch,
} from "../../repository/src/patch";
import { detectTestCommands, ProjectManifest } from "../../test-runner/src/commands";
import { runTests, TestRunResult, testRunner } from "../../test-runner/src/runner";
import { collectArtifacts, ArtifactRecord } from "../../artifacts/src/store";
import { githubAdapter, GitHubAdapter } from "../../github/src/adapter";
import { GitHubBranch } from "../../github/src/branches";
import { runRepository } from "../../runs/src/run-repository";
import { secretBroker } from "../../secrets/src/broker";

export { secretBroker };
export { BASE_DEFAULT_PROFILE as DEFAULT_SANDBOX_PROFILE };
export type { SandboxProfile, SandboxHandle };

export interface SandboxRequest {
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId?: string;

  taskType: "patch" | "test" | "review";
  repositoryId: string;
  commitSha: string;

  networkRequired?: boolean;
  requestedHosts?: string[];
  cancellationEpoch: number;
}

export interface SandboxSessionRecord {
  id: string;
  sessionId: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  stepId?: string;
  profileName: string;
  runtime: string;
  imageDigest: string;
  status:
    | "provisioning"
    | "ready"
    | "running"
    | "collecting"
    | "destroying"
    | "destroyed"
    | "failed"
    | "cleanup_failed"
    | "cancelled";
  containerId?: string;
  workspacePath?: string;
  cpuLimit: string;
  memoryLimit: string;
  pidsLimit: number;
  networkMode: string;
  allowedHosts: string[];
  processTreeEmpty?: boolean;
  filesystemSanitized?: boolean;
  networkIdentityRotated?: boolean;
  credentialsRevoked?: boolean;
  failureCode?: string;
  createdAt: string;
  destroyedAt?: string;
}

// Backward-compatible SandboxSession interface
export type SandboxSession = SandboxSessionRecord;

export class SandboxScheduler {
  private sessions: Map<string, SandboxSessionRecord> = new Map();
  private handles: Map<string, SandboxHandle> = new Map();

  constructor(
    private rt: SandboxRuntime = runtime,
    private ghAdapter: GitHubAdapter = githubAdapter
  ) {}

  /**
   * Provisions a sandbox with strict immutable profiles and tenant snapshot
   */
  public async provision(
    requestOrRunId: SandboxRequest | string
  ): Promise<SandboxHandle> {
    const request: SandboxRequest =
      typeof requestOrRunId === "string"
        ? {
            tenantId: "tenant_default",
            workspaceId: "ws_default",
            runId: requestOrRunId,
            stepId: "step_0",
            taskType: "patch",
            repositoryId: "repo_default",
            commitSha: "head_main_sha",
            networkRequired: false,
            requestedHosts: [],
            cancellationEpoch: 0,
          }
        : requestOrRunId;

    // 1. Select immutable profile (agent CANNOT pick arbitrary profiles)
    const profile = profileSelector.select(
      request.taskType,
      Boolean(request.networkRequired)
    );

    // 2. Validate profile immutability & non-root constraints
    profileValidator.validate(profile);

    // 3. Network policy validation
    validateNetworkRequest(profile, request.requestedHosts || []);

    // 4. Assert run is executable before allocating resources
    await runRepository.assertExecutable(
      request.runId,
      request.cancellationEpoch
    );

    // 5. Obtain repository snapshot for commit SHA
    const snapshot = await snapshotService.getOrCreate({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      commitSha: request.commitSha,
    });

    const sessionId = `sbx_${Math.random().toString(36).substring(2, 10)}`;
    const session: SandboxSessionRecord = {
      id: sessionId,
      sessionId,
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      runId: request.runId,
      stepId: request.stepId,
      profileName: profile.name,
      runtime: profile.runtime,
      imageDigest: profile.imageDigest,
      status: "provisioning",
      cpuLimit: profile.cpuLimit,
      memoryLimit: profile.memoryLimit,
      pidsLimit: profile.pidsLimit,
      networkMode: profile.networkMode,
      allowedHosts: profile.allowedHosts,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);

    try {
      // 6. Check warm pool or provision fresh container
      let containerId: string;
      const warm = await warmPoolManager.claimWarmSandbox(profile);

      if (warm) {
        containerId = warm.id;
      } else {
        const container = await this.rt.provision({
          imageDigest: profile.imageDigest,
          cpuLimit: profile.cpuLimit,
          memoryLimit: profile.memoryLimit,
          pidsLimit: profile.pidsLimit,
          runAsUser: profile.runAsUser,
          readOnlyRootFilesystem: profile.readOnlyRootFilesystem,
          allowPrivilegeEscalation: profile.allowPrivilegeEscalation,
          network: {
            mode: profile.networkMode,
            allowedHosts: profile.allowedHosts,
          },
        });
        containerId = container.id;
      }

      // 7. Attach repository snapshot
      const workspacePath = await this.rt.attachSnapshot(
        { id: containerId },
        snapshot.objectKey
      );

      session.status = "ready";
      session.containerId = containerId;
      session.workspacePath = workspacePath;

      const handle: SandboxHandle = {
        sessionId,
        runtime: profile.runtime,
        containerId,
        profile,
        workspacePath,
        cancellationEpoch: request.cancellationEpoch,
        runId: request.runId,
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        stepId: request.stepId,
      };

      this.handles.set(sessionId, handle);
      return handle;
    } catch (error: any) {
      session.status = "failed";
      session.failureCode = error?.message || "PROVISION_FAILED";
      throw error;
    }
  }

  /**
   * Executes a restricted command inside the sandbox
   */
  public async execute(
    sandbox: SandboxHandle,
    command: SandboxCommand
  ): Promise<CommandResult> {
    // 1. Executable allowlist check (blocks general shells like sh, bash)
    validateCommand(command);

    // 2. Cancellation epoch guard
    await runRepository.assertExecutable(
      sandbox.runId,
      sandbox.cancellationEpoch
    );

    // 3. Workspace scope boundary check (blocks ../../etc traversal)
    if (sandbox.workspacePath) {
      resolveSafePath(sandbox.workspacePath, command.cwd);
    }

    // 4. Update session status
    const session = this.sessions.get(sandbox.sessionId);
    if (session) {
      session.status = "running";
    }

    // 5. Delegate to isolated runtime
    const result = await this.rt.execute(sandbox.containerId, command);

    if (session) {
      session.status = "ready";
    }

    return result;
  }

  /**
   * Collects, redacts, hashes, and stores sandbox artifacts
   */
  public async collectArtifacts(
    sandbox: SandboxHandle
  ): Promise<ArtifactRecord[]> {
    const session = this.sessions.get(sandbox.sessionId);
    if (session) {
      session.status = "collecting";
    }

    const artifacts = await collectArtifacts(sandbox, this.rt);

    if (session) {
      session.status = "ready";
    }

    return artifacts;
  }

  /**
   * Destroys the sandbox and verifies cleanup of network, credentials, and processes
   */
  public async destroy(
    sandboxOrSessionId: SandboxHandle | string
  ): Promise<CleanupResult> {
    const handle =
      typeof sandboxOrSessionId === "string"
        ? this.handles.get(sandboxOrSessionId)
        : sandboxOrSessionId;

    const sessionId =
      typeof sandboxOrSessionId === "string"
        ? sandboxOrSessionId
        : sandboxOrSessionId.sessionId;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "destroying";
    }

    if (!handle) {
      if (session) {
        session.status = "destroyed";
        session.destroyedAt = new Date().toISOString();
      }
      return { destroyed: true, verified: true };
    }

    try {
      const result = await destroySandbox(handle);

      if (session) {
        session.status = "destroyed";
        session.destroyedAt = new Date().toISOString();
        session.processTreeEmpty = true;
        session.filesystemSanitized = true;
        session.networkIdentityRotated = true;
        session.credentialsRevoked = true;
      }

      this.handles.delete(sessionId);
      return result;
    } catch (error: any) {
      if (session) {
        session.status = "cleanup_failed";
        session.failureCode = error?.message;
      }
      throw error;
    }
  }

  /**
   * Cancels the sandbox execution immediately
   */
  public async cancel(sandbox: SandboxHandle): Promise<void> {
    const session = this.sessions.get(sandbox.sessionId);
    if (session) {
      session.status = "cancelled";
    }
    await this.destroy(sandbox);
  }

  public getSession(sessionId: string): SandboxSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): SandboxSessionRecord[] {
    return Array.from(this.sessions.values());
  }

  public clear(): void {
    this.sessions.clear();
    this.handles.clear();
  }
}

export const sandboxScheduler = new SandboxScheduler();

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
  artifacts: ArtifactRecord[];
  readyForCommit: boolean;
}

/**
 * End-to-end Sprint 5 Patch Execution Workflow
 */
export async function executePatchWorkflow(
  input: PatchWorkflowInput,
  scheduler: SandboxScheduler = sandboxScheduler,
  adapter: GitHubAdapter = githubAdapter
): Promise<PatchWorkflowResult> {
  // 1. Validate patch bounds & syntax before any allocation
  validatePatch(input.patch);

  // 2. Create or reuse branch via idempotent GitHub Adapter
  const branch = await adapter.createBranch({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    runId: input.runId,
    repositoryId: input.repositoryId,
    branchName: input.branchName,
    baseSha: input.baseSha,
  });

  // 3. Provision sandbox through Sandbox Scheduler
  const sandbox = await scheduler.provision({
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
    // 4. Apply patch inside sandbox workspace
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
      sandbox,
      scheduler
    );

    // 5. Detect and execute test commands
    const manifest: ProjectManifest = { packageManager: "pnpm" };
    const testCommands = detectTestCommands(manifest);
    const tests = await testRunner.run(sandbox, testCommands, scheduler);

    // 6. Collect, redact, hash, and persist artifacts
    const artifacts = await scheduler.collectArtifacts(sandbox);

    return {
      branch,
      diff: patchResult.diff,
      tests,
      artifacts,
      readyForCommit: tests.passed,
    };
  } finally {
    // 7. Guaranteed destruction & cleanup verification in finally block
    await scheduler.destroy(sandbox);
  }
}
