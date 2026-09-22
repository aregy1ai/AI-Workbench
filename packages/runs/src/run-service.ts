/**
 * AI Workbench - Run Orchestration Service & Idempotency Engine
 * Sprint 2: Core Run Engine
 */

import { Run } from "../../contracts/src/run";
import { RequestContext } from "../../contracts/src/context";
import { assertContext } from "../../auth/src/context";
import { assertPermission } from "../../authorization/src/authorize";
import { runRepository } from "./run-repository";
import { redisQueue } from "../../queue/src/redis-queue";
import { outboxManager } from "../../events/src/outbox";
import { auditLedger } from "../../audit/src/hash-chain";
import { secretBroker, sandboxScheduler } from "../../sandbox/src/scheduler";
import { WorkerLease } from "../../worker/src/lease-manager";

export interface CreateRunInput {
  taskId: string;
  workspaceId: string;
  budgetLimit: number;
  clientRequestId: string;
}

export class RunService {
  private deduplicationStore: Map<string, Run> = new Map();

  /**
   * Idempotent run creation with Outbox and Redis Queue dispatch
   */
  public async create(input: CreateRunInput, context: RequestContext): Promise<Run> {
    assertContext(context);
    assertPermission(context.roles, "run:create");

    const idempotencyKey = `run:create:${input.clientRequestId}`;
    const cached = this.deduplicationStore.get(idempotencyKey);
    if (cached) {
      return cached;
    }

    const runId = `run_${Math.random().toString(36).substring(2, 9)}`;
    const newRun: Run = {
      id: runId,
      tenantId: context.tenantId,
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      status: "queued",
      version: 0,
      cancellationEpoch: 0,
      runtimeName: "default-runtime",
      runtimeVersion: "1.0.0",
      budgetLimit: input.budgetLimit || 10.0,
      budgetReserved: 0,
      budgetConsumed: 0,
      createdAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
    };

    // Save to repository
    runRepository.save(newRun);

    // Save to deduplication store
    this.deduplicationStore.set(idempotencyKey, newRun);

    // Record Outbox event
    outboxManager.recordEvent(
      context.tenantId,
      "run.created",
      "run",
      newRun.id,
      {
        runId: newRun.id,
        taskId: newRun.taskId,
        budgetLimit: newRun.budgetLimit,
      }
    );

    // Enqueue to Redis queue
    await redisQueue.enqueueRun(newRun);

    return newRun;
  }

  /**
   * Request atomic cancellation with tenant isolation assertion
   */
  public async requestCancellation(runId: string, context: RequestContext): Promise<Run> {
    assertContext(context);
    assertPermission(context.roles, "run:cancel");

    const run = runRepository.get(runId);
    if (!run || run.tenantId !== context.tenantId) {
      // Must fail closed with RUN_NOT_FOUND to prevent tenant resource enumeration
      throw new Error("RUN_NOT_FOUND");
    }

    if (["succeeded", "failed", "cancelled", "cancel_failed"].includes(run.status)) {
      return run;
    }

    const updatedRun: Run = {
      ...run,
      status: "cancellation_requested",
      cancellationEpoch: run.cancellationEpoch + 1,
      version: run.version + 1,
    };

    runRepository.save(updatedRun);

    // Revoke any active secret leases immediately
    const activeLeases = secretBroker.getActiveLeases(runId);
    activeLeases.forEach((l) => secretBroker.revoke(l.id));

    // Audit event
    auditLedger.append({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      actorId: context.actorId,
      eventType: "run.cancelled",
      payloadSummary: `Cancellation requested by ${context.actorId}. Cancellation epoch bumped to ${updatedRun.cancellationEpoch}`,
    });

    return updatedRun;
  }

  /**
   * Executes deep cancellation workflow: revokes secrets, terminates sandbox, saves partials
   */
  public async executeCancellation(runId: string, lease: WorkerLease): Promise<void> {
    const run = runRepository.get(runId);
    if (!run) return;

    await runRepository.markCancelling(runId);

    // 1. Revoke all active leases
    const leases = secretBroker.getActiveLeases(runId);
    leases.forEach((l) => secretBroker.revoke(l.id));

    // 2. Terminate any running sandbox sessions
    const sandboxSession = sandboxScheduler.getSession(runId);
    if (sandboxSession) {
      sandboxScheduler.destroy(sandboxSession.sessionId);
    }

    // 3. Mark final status
    await runRepository.markCancelled(runId);

    auditLedger.append({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      actorId: lease.workerId,
      eventType: "run.cancelled",
      payloadSummary: `Cancellation executed by worker ${lease.workerId}. Sandbox terminated and state locked.`,
    });
  }

  public clear(): void {
    this.deduplicationStore.clear();
  }
}

export const runService = new RunService();
