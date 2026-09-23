/**
 * AI Workbench - Worker Lease, Heartbeat & Crash Recovery
 * Sprint 2: Core Run Engine
 */

import { runRepository } from "../../runs/src/run-repository";
import { redisQueue } from "../../queue/src/redis-queue";

export interface WorkerLease {
  runId: string;
  workerId: string;
  leaseToken: string;
  expiresAt: number; // timestamp in ms
  heartbeatAt: number;
}

export class WorkerLeaseManager {
  private leases: Map<string, WorkerLease> = new Map();
  public static readonly LEASE_DURATION_MS = 30000; // 30s
  public static readonly HEARTBEAT_INTERVAL_MS = 10000; // 10s

  /**
   * Worker atomically claims a queued run
   */
  public async claimRun(runId: string, workerId: string): Promise<WorkerLease> {
    const run = runRepository.get(runId);
    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    const existingLease = this.leases.get(runId);
    const now = Date.now();

    if (existingLease && existingLease.expiresAt > now) {
      // If the same worker is claiming the run again, or lease is within active heartbeat, renew it
      if (existingLease.workerId === workerId) {
        existingLease.expiresAt = now + WorkerLeaseManager.LEASE_DURATION_MS;
        existingLease.heartbeatAt = now;
        return existingLease;
      }
      throw new Error("RUN_ALREADY_CLAIMED");
    }

    const leaseToken = `lease_${Math.random().toString(36).substring(2, 9)}_${now}`;
    const lease: WorkerLease = {
      runId,
      workerId,
      leaseToken,
      expiresAt: now + WorkerLeaseManager.LEASE_DURATION_MS,
      heartbeatAt: now,
    };

    this.leases.set(runId, lease);

    // Atomically transition run to 'running' if it was queued
    if (run.status === "queued") {
      await runRepository.transition(runId, "running", run.version);
    }

    return lease;
  }

  /**
   * Worker heartbeat to extend lease
   */
  public async heartbeat(lease: WorkerLease): Promise<void> {
    const active = this.leases.get(lease.runId);
    const now = Date.now();

    if (
      !active ||
      active.workerId !== lease.workerId ||
      active.leaseToken !== lease.leaseToken ||
      active.expiresAt <= now
    ) {
      throw new Error("WORKER_LEASE_LOST");
    }

    active.expiresAt = now + WorkerLeaseManager.LEASE_DURATION_MS;
    active.heartbeatAt = now;
  }

  /**
   * Explicit release when step cycle finishes
   */
  public async releaseLease(lease: WorkerLease): Promise<void> {
    const active = this.leases.get(lease.runId);
    if (active && active.leaseToken === lease.leaseToken) {
      this.leases.delete(lease.runId);
    }
  }

  /**
   * Simulates lease expiration for testing
   */
  public expireLease(runId: string): void {
    const active = this.leases.get(runId);
    if (active) {
      active.expiresAt = Date.now() - 5000;
    }
  }

  /**
   * Scans for stale worker leases whose heartbeat expired, and requeues them
   */
  public async recoverExpiredLeases(): Promise<string[]> {
    const now = Date.now();
    const recoveredRunIds: string[] = [];

    for (const [runId, lease] of this.leases.entries()) {
      if (lease.expiresAt < now) {
        this.leases.delete(runId);

        const run = runRepository.get(runId);
        if (run && !["succeeded", "failed", "cancelled"].includes(run.status)) {
          // Re-queue run
          const updatedRun = {
            ...run,
            status: "queued" as const,
            version: run.version + 1,
          };
          runRepository.save(updatedRun);
          await redisQueue.enqueueRun(updatedRun);
          recoveredRunIds.push(runId);
        }
      }
    }

    return recoveredRunIds;
  }

  public getActiveLeases(): WorkerLease[] {
    const now = Date.now();
    return Array.from(this.leases.values()).filter((l) => l.expiresAt > now);
  }

  public clear(): void {
    this.leases.clear();
  }
}

export const workerLeaseManager = new WorkerLeaseManager();
