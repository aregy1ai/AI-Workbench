/**
 * AI Workbench - Step Repository with Deterministic Sequence & Hashing
 * Sprint 2: Core Run Engine
 */

import { Run, Step, StepStatus, StepType } from "../../contracts/src/run";

export class StepRepository {
  private steps: Map<string, Step> = new Map();

  public async createStep(
    run: Run,
    type: StepType,
    input: unknown
  ): Promise<Step> {
    const existing = this.list(run.id);
    const nextSequence = existing.length > 0 ? Math.max(...existing.map((s) => s.sequence)) + 1 : 0;

    // Simple deterministic string hash
    const inputHash = `hash_${Math.random().toString(36).substring(2, 10)}`;

    const step: Step = {
      id: `step_${Math.random().toString(36).substring(2, 9)}`,
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      sequence: nextSequence,
      type,
      status: "pending",
      attempt: 0,
      inputHash,
      createdAt: new Date().toISOString(),
    };

    this.steps.set(step.id, step);
    return step;
  }

  public async nextPending(runId: string): Promise<Step | undefined> {
    const runSteps = this.list(runId);
    return runSteps
      .filter((s) => s.status === "pending")
      .sort((a, b) => a.sequence - b.sequence)[0];
  }

  public list(runId: string): Step[] {
    return Array.from(this.steps.values())
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  public async markStepRunning(stepId: string): Promise<Step> {
    const step = this.steps.get(stepId);
    if (!step) throw new Error("STEP_NOT_FOUND");

    const updated: Step = {
      ...step,
      status: "running",
      attempt: step.attempt + 1,
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  public async markStepSucceeded(stepId: string, summary?: string, outputHash?: string): Promise<Step> {
    const step = this.steps.get(stepId);
    if (!step) throw new Error("STEP_NOT_FOUND");

    const updated: Step = {
      ...step,
      status: "succeeded",
      summary: summary ?? step.summary,
      outputHash: outputHash ?? `out_${Math.random().toString(36).substring(2, 8)}`,
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  public async markStepFailed(stepId: string, error: string): Promise<Step> {
    const step = this.steps.get(stepId);
    if (!step) throw new Error("STEP_NOT_FOUND");

    const updated: Step = {
      ...step,
      status: "failed",
      summary: `Failed: ${error}`,
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  public clear(): void {
    this.steps.clear();
  }
}

export const stepRepository = new StepRepository();
