/**
 * AI Workbench - Parallel Tool Call Orchestrator & DAG Dependency Engine
 * v2 Architecture: Performance, Speed & Efficiency (§6.2)
 */

import { auditLedger } from "../../audit/src/ledger";

export interface ParallelToolTask {
  id: string;
  toolName: string;
  input: any;
  dependsOn?: string[]; // IDs of tasks that must finish before this task can start
  status?: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  result?: any;
  error?: string;
}

export interface ParallelExecutionSummary {
  runId: string;
  totalTasks: number;
  concurrencyCap: number;
  wallClockDurationMs: number;
  sequentialTheoreticalDurationMs: number;
  speedupFactor: number;
  allSucceeded: boolean;
  failedTaskIds: string[];
}

export class ParallelToolOrchestrator {
  private defaultConcurrencyCap = 4;

  /**
   * Resolves DAG dependencies and executes independent tool tasks concurrently up to concurrencyCap
   */
  public async executeToolDAG(
    runId: string,
    tasks: ParallelToolTask[],
    options: {
      concurrencyCap?: number;
      failFast?: boolean;
      onTaskCompleted?: (task: ParallelToolTask) => void;
    } = {}
  ): Promise<ParallelExecutionSummary> {
    const startTime = Date.now();
    const cap = options.concurrencyCap || this.defaultConcurrencyCap;
    const taskMap = new Map<string, ParallelToolTask>(tasks.map((t) => [t.id, { ...t, status: "pending" }]));
    const runningTasks = new Set<string>();
    const completedTasks = new Set<string>();
    const failedTasks = new Set<string>();

    let theoreticalSequentialDuration = 0;
    let aborted = false;

    // Simulate asynchronous task work
    const executeTask = async (task: ParallelToolTask): Promise<void> => {
      task.status = "running";
      task.startedAt = Date.now();
      runningTasks.add(task.id);

      // Simulate realistic tool durations (e.g. read_file: ~80ms, linter: ~220ms, test: ~300ms)
      const mockDuration = task.toolName.includes("read") ? 75 : task.toolName.includes("lint") ? 190 : 250;
      theoreticalSequentialDuration += mockDuration;

      await new Promise((r) => setTimeout(r, mockDuration));

      task.completedAt = Date.now();
      task.durationMs = task.completedAt - task.startedAt;
      runningTasks.delete(task.id);

      // Simulate failure on tasks named "failing_task"
      if (task.toolName === "faulty.tool_crash") {
        task.status = "failed";
        task.error = "SIMULATED_FAIL_FAST_ERROR";
        failedTasks.add(task.id);
        if (options.failFast) {
          aborted = true;
        }
      } else {
        task.status = "completed";
        task.result = { outcome: "SUCCESS", recordsProcessed: 1 };
        completedTasks.add(task.id);
      }

      if (options.onTaskCompleted) {
        options.onTaskCompleted(task);
      }
    };

    // Execution loop resolving DAG
    while (completedTasks.size + failedTasks.size < taskMap.size && !aborted) {
      const runnable: ParallelToolTask[] = [];

      for (const task of taskMap.values()) {
        if (task.status === "pending") {
          const deps = task.dependsOn || [];
          const depsSatisfied = deps.every((dId) => completedTasks.has(dId));
          const depsFailed = deps.some((dId) => failedTasks.has(dId));

          if (depsFailed) {
            task.status = "skipped";
            failedTasks.add(task.id);
          } else if (depsSatisfied && runningTasks.size + runnable.length < cap) {
            runnable.push(task);
          }
        }
      }

      if (runnable.length === 0 && runningTasks.size === 0) {
        // Deadlock or finished
        break;
      }

      if (runnable.length > 0) {
        // Launch runnable batch concurrently
        await Promise.race([
          ...runnable.map((t) => executeTask(t)),
          ...Array.from(runningTasks).map((id) =>
            new Promise((r) => setTimeout(r, 10))
          ),
        ]);
      } else {
        // Wait for any running task to free up concurrency slot
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    const wallClockDurationMs = Date.now() - startTime;
    const speedup = theoreticalSequentialDuration > 0
      ? Number((theoreticalSequentialDuration / Math.max(wallClockDurationMs, 1)).toFixed(2))
      : 1.0;

    auditLedger.record({
      tenantId: "system_parallel_orchestrator",
      runId,
      eventType: "PARALLEL_TOOL_DAG_EXECUTED",
      actorId: "parallel_tool_orchestrator",
      actorType: "system",
      details: {
        totalTasks: tasks.length,
        wallClockDurationMs,
        speedupFactor: speedup,
        failedCount: failedTasks.size,
      },
    });

    return {
      runId,
      totalTasks: tasks.length,
      concurrencyCap: cap,
      wallClockDurationMs,
      sequentialTheoreticalDurationMs: theoreticalSequentialDuration,
      speedupFactor: speedup,
      allSucceeded: failedTasks.size === 0,
      failedTaskIds: Array.from(failedTasks),
    };
  }
}

export const parallelToolOrchestrator = new ParallelToolOrchestrator();
