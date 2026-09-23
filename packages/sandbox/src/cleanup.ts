/**
 * AI Workbench - Sandbox Cleanup & Lifecycle Destruction Engine
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { runtime } from "./runtime";
import { SandboxProfile } from "./profiles";

export interface SandboxHandle {
  sessionId: string;
  runtime: string;
  containerId: string;
  profile: SandboxProfile;
  workspacePath: string;
  cancellationEpoch: number;
  runId: string;
  tenantId?: string;
  workspaceId?: string;
  stepId?: string;
}

export interface CleanupResult {
  destroyed: boolean;
  verified: boolean;
}

export async function destroySandbox(
  sandbox: SandboxHandle
): Promise<CleanupResult> {
  const errors: string[] = [];

  try {
    await runtime.revokeNetwork(sandbox.containerId);
  } catch (error: any) {
    errors.push("NETWORK_REVOKE_FAILED");
  }

  try {
    await runtime.deleteCredentials(sandbox.containerId);
  } catch (error: any) {
    errors.push("CREDENTIAL_DELETE_FAILED");
  }

  try {
    await runtime.destroy(sandbox.containerId);
  } catch (error: any) {
    errors.push("RUNTIME_DESTROY_FAILED");
  }

  try {
    await runtime.verifyDestroyed(sandbox.containerId);
  } catch (error: any) {
    errors.push("CLEANUP_VERIFICATION_FAILED");
  }

  if (errors.length > 0) {
    throw new Error(`SANDBOX_CLEANUP_FAILED:${errors.join(",")}`);
  }

  return {
    destroyed: true,
    verified: true,
  };
}

export class SandboxCleanupManager {
  public async destroy(sandboxOrContainerId: SandboxHandle | string): Promise<CleanupResult> {
    if (typeof sandboxOrContainerId === "string") {
      return destroySandbox({
        sessionId: sandboxOrContainerId,
        containerId: sandboxOrContainerId,
        runtime: "gvisor",
        profile: {} as any,
        workspacePath: "/sandbox",
        cancellationEpoch: 0,
        runId: "unknown",
      });
    }
    return destroySandbox(sandboxOrContainerId);
  }
}

export const sandboxCleanupManager = new SandboxCleanupManager();

