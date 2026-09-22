/**
 * AI Workbench - Run, Task & Step Lifecycle Contracts
 * Phase: Sprint 1 Core Contracts
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ActorType = "user" | "agent" | "worker" | "service";

export interface Actor {
  type: ActorType;
  id: string;
  name?: string;
  tenantId: string;
}

export type TaskStatus = "created" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  title: string;
  description: string;
  baseBranch: string;
  requestedBy: string;
  riskLevel: RiskLevel;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus =
  | "created"
  | "queued"
  | "running"
  | "waiting_approval"
  | "cancellation_requested"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "cancel_failed";

export interface Run {
  id: string;
  tenantId: string;
  workspaceId: string;
  taskId: string;
  status: RunStatus;
  cancellationEpoch: number;
  version: number;
  runtimeName: string;
  runtimeVersion: string;
  budgetLimit: number;
  budgetReserved: number;
  budgetConsumed: number;
  workerId?: string;
  workerLeaseExpiresAt?: string;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

export type StepType = "reasoning" | "tool_call" | "approval" | "checkpoint";

export type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Step {
  id: string;
  tenantId: string;
  workspaceId: string;
  runId: string;
  sequence: number;
  type: StepType;
  status: StepStatus;
  inputHash: string;
  outputHash?: string;
  attempt: number;
  summary?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CreateRunInput {
  clientRequestId: string;
  workspaceId: string;
  taskId: string;
  budgetLimit: number;
  runtime?: string;
}

export interface CancelRunInput {
  runId: string;
  reason: string;
  requestedBy: string;
}
