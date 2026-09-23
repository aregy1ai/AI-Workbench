/**
 * AI Workbench - Warm Sandbox Pool
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { SandboxProfile } from "./profiles";
import { runtime } from "./runtime";

export interface WarmSandbox {
  id: string;
  profileName: string;
  imageDigest: string;
  status: "ready" | "claimed" | "retiring";
  createdAt: Date;
}

export class WarmPoolManager {
  private pool: Map<string, WarmSandbox> = new Map();

  public async seed(profile: SandboxProfile, count: number = 2): Promise<void> {
    for (let i = 0; i < count; i++) {
      const container = await runtime.provision({
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

      this.pool.set(container.id, {
        id: container.id,
        profileName: profile.name,
        imageDigest: profile.imageDigest,
        status: "ready",
        createdAt: new Date(),
      });
    }
  }

  public async claimWarmSandbox(
    profile: SandboxProfile
  ): Promise<WarmSandbox | undefined> {
    for (const [id, sbx] of this.pool.entries()) {
      if (
        sbx.profileName === profile.name &&
        sbx.imageDigest === profile.imageDigest &&
        sbx.status === "ready"
      ) {
        sbx.status = "claimed";

        // Reset filesystem & network before handing to tenant
        await runtime.resetFilesystem(id);
        await runtime.resetNetwork(id);

        this.pool.delete(id);
        return sbx;
      }
    }

    return undefined;
  }

  public getPoolSize(): number {
    return Array.from(this.pool.values()).filter((s) => s.status === "ready").length;
  }
}

export const warmPoolManager = new WarmPoolManager();
