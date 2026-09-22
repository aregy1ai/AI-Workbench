/**
 * AI Workbench - Worker Loop & Agent Run Execution Pipeline
 * Phase: Sprint 1 Worker Execution Loop
 */

import { Run, Step } from "../../../packages/contracts/src/run";
import { runStateMachine } from "../../../packages/runs/src/state-machine";

export interface RunJob {
  runId: string;
  tenantId: string;
  workspaceId: string;
}

export interface WorkerStepResult {
  stepType: "reasoning" | "tool_call" | "approval_required" | "complete";
  toolName?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export class RunExecutionWorker {
  /**
   * Executes single worker run cycle with optimistic concurrency & cancellation checks
   */
  public async executeCycle(
    run: Run,
    stepProvider: (run: Run) => Promise<WorkerStepResult>
  ): Promise<{ run: Run; step?: Step; terminated: boolean; reason?: string }> {
    // 1. Verify executable state
    if (run.status === "cancellation_requested" || run.status === "cancelling") {
      const cancelledRun = runStateMachine.transition(run, "cancelled", run.version);
      return {
        run: cancelledRun.ok ? cancelledRun.value : run,
        terminated: true,
        reason: "RUN_CANCELLED",
      };
    }

    if (run.status === "queued") {
      const running = runStateMachine.transition(run, "running", run.version);
      if (!running.ok) {
        return { run, terminated: true, reason: running.error.message };
      }
      run = running.value;
    }

    // 2. Query next agent step
    const stepResult = await stepProvider(run);

    const stepId = `step_${Math.random().toString(36).substring(2, 9)}`;
    const step: Step = {
      id: stepId,
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      sequence: run.version,
      type: stepResult.stepType === "approval_required" ? "approval" : (stepResult.stepType as any),
      status: "succeeded",
      inputHash: `in_${Date.now()}`,
      outputHash: `out_${Date.now()}`,
      attempt: 1,
      summary: stepResult.summary,
      details: stepResult.details,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // 3. Evaluate step outcome
    if (stepResult.stepType === "approval_required") {
      const waiting = runStateMachine.transition(run, "waiting_approval", run.version);
      return {
        run: waiting.ok ? waiting.value : run,
        step,
        terminated: false,
        reason: "WAITING_APPROVAL",
      };
    }

    if (stepResult.stepType === "complete") {
      const succeeded = runStateMachine.transition(run, "succeeded", run.version);
      return {
        run: succeeded.ok ? succeeded.value : run,
        step,
        terminated: true,
        reason: "SUCCEEDED",
      };
    }

    // Still running, increment state version
    const progressing = runStateMachine.transition(run, "running", run.version);
    return {
      run: progressing.ok ? progressing.value : run,
      step,
      terminated: false,
    };
  }
}

export const runExecutionWorker = new RunExecutionWorker();
