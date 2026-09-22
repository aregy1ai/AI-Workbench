/**
 * AI Workbench - Run State Machine & Optimistic Locking
 * Sprint 2: Core Run Engine
 */

import { Run, RunStatus } from "../../contracts/src/run";
import { failure, Result, success } from "../../contracts/src/errors";

export const transitions: Record<RunStatus, readonly RunStatus[]> = {
  created: ["queued", "failed"],
  queued: ["running", "cancellation_requested", "failed"],
  running: [
    "waiting_approval",
    "succeeded",
    "failed",
    "cancellation_requested",
  ],
  waiting_approval: [
    "running",
    "failed",
    "cancellation_requested",
  ],
  cancellation_requested: ["cancelling", "cancel_failed"],
  cancelling: ["cancelled", "cancel_failed"],
  succeeded: [],
  failed: [],
  cancelled: [],
  cancel_failed: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  const allowed = transitions[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`INVALID_RUN_TRANSITION:${from}:${to}`);
  }
}

export interface TransitionInput {
  runId: string;
  from: RunStatus;
  to: RunStatus;
  expectedVersion: number;
  failureCode?: string;
}

export class RunStateMachine {
  public canTransition(from: RunStatus, to: RunStatus): boolean {
    return canTransition(from, to);
  }

  public assertTransition(from: RunStatus, to: RunStatus): void {
    assertTransition(from, to);
  }

  /**
   * Evaluates state transition in memory with optimistic locking
   */
  public transition(
    run: Run,
    nextStatus: RunStatus,
    expectedVersion: number,
    failureCode?: string
  ): Result<Run> {
    if (run.version !== expectedVersion) {
      return failure(
        "RUN_VERSION_CONFLICT",
        `STALE_RUN_VERSION: Expected version ${expectedVersion}, but run is at version ${run.version}`
      );
    }

    if (!canTransition(run.status, nextStatus)) {
      return failure(
        "RUN_NOT_EXECUTABLE",
        `INVALID_RUN_TRANSITION: Cannot transition run from '${run.status}' to '${nextStatus}'`
      );
    }

    const now = new Date().toISOString();
    return success({
      ...run,
      status: nextStatus,
      version: run.version + 1,
      startedAt: nextStatus === "running" && !run.startedAt ? now : run.startedAt,
      finishedAt: ["succeeded", "failed", "cancelled"].includes(nextStatus) ? now : run.finishedAt,
      failureCode: failureCode ?? run.failureCode,
    });
  }

  /**
   * Atomically transitions run to cancellation_requested and bumps epoch
   */
  public requestCancellation(run: Run, expectedVersion: number): Result<Run> {
    if (run.version !== expectedVersion) {
      return failure(
        "RUN_VERSION_CONFLICT",
        `STALE_RUN_VERSION: Expected version ${expectedVersion}, but run is at version ${run.version}`
      );
    }

    if (["succeeded", "failed", "cancelled", "cancel_failed"].includes(run.status)) {
      return failure(
        "RUN_NOT_EXECUTABLE",
        `Cannot cancel run already in terminal state '${run.status}'`
      );
    }

    return success({
      ...run,
      status: "cancellation_requested",
      cancellationEpoch: run.cancellationEpoch + 1,
      version: run.version + 1,
    });
  }
}

export const runStateMachine = new RunStateMachine();
