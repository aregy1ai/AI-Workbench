/**
 * AI Workbench - Run Repository with Optimistic Version Locking & RLS
 * Sprint 2: Core Run Engine
 */

import { Run, RunStatus } from "../../contracts/src/run";
import { assertTransition } from "./state-machine";

export class RunRepository {
  private runs: Map<string, Run> = new Map();

  public save(run: Run): Run {
    this.runs.set(run.id, { ...run });
    return run;
  }

  public get(runId: string): Run | undefined {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }

  public listByTenant(tenantId: string): Run[] {
    return Array.from(this.runs.values()).filter((r) => r.tenantId === tenantId);
  }

  /**
   * Atomic transition with optimistic version locking
   */
  public async transition(
    runId: string,
    to: RunStatus,
    expectedVersion: number,
    failureCode?: string
  ): Promise<Run> {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error("RUN_NOT_FOUND");
    }

    if (current.version !== expectedVersion) {
      throw new Error("STALE_RUN_VERSION");
    }

    assertTransition(current.status, to);

    const now = new Date().toISOString();
    const updated: Run = {
      ...current,
      status: to,
      version: current.version + 1,
      startedAt: to === "running" && !current.startedAt ? now : current.startedAt,
      finishedAt: ["succeeded", "failed", "cancelled"].includes(to) ? now : current.finishedAt,
      failureCode: failureCode ?? current.failureCode,
    };

    this.runs.set(runId, updated);
    return updated;
  }

  public async markSucceeded(runId: string): Promise<Run> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    return this.transition(runId, "succeeded", run.version);
  }

  public async markFailed(runId: string, failureCode: string): Promise<Run> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    return this.transition(runId, "failed", run.version, failureCode);
  }

  public async markCancelling(runId: string): Promise<Run> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    return this.transition(runId, "cancelling", run.version);
  }

  public async markCancelled(runId: string): Promise<Run> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    return this.transition(runId, "cancelled", run.version);
  }

  public clear(): void {
    this.runs.clear();
  }
}

export const runRepository = new RunRepository();
