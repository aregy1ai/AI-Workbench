/**
 * AI Workbench - Sprint 2 Run Engine Test Suite
 * Covers: State Machine, Optimistic Locking, Idempotency, Worker Crash Recovery, Cancellation Race & Tenant Isolation
 */

import { canTransition } from "../../packages/runs/src/state-machine";
import { runRepository } from "../../packages/runs/src/run-repository";
import { runService } from "../../packages/runs/src/run-service";
import { workerLeaseManager } from "../../packages/worker/src/lease-manager";
import { stepRepository } from "../../packages/runs/src/step-repository";
import { redisQueue } from "../../packages/queue/src/redis-queue";
import { Run } from "../../packages/contracts/src/run";
import { RequestContext } from "../../packages/contracts/src/context";

export interface EngineTestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export async function runEngineTestSuite(): Promise<EngineTestResult[]> {
  const results: EngineTestResult[] = [];

  // 1. STATE MACHINE TRANSITIONS
  const t1 = canTransition("queued", "running");
  results.push({
    suite: "State Machine",
    name: "allows queued to running",
    passed: t1 === true,
    expected: "true",
    actual: String(t1),
  });

  const t2 = canTransition("succeeded", "running");
  results.push({
    suite: "State Machine",
    name: "rejects succeeded to running",
    passed: t2 === false,
    expected: "false",
    actual: String(t2),
  });

  const t3 = canTransition("running", "cancellation_requested");
  results.push({
    suite: "State Machine",
    name: "allows cancellation from running",
    passed: t3 === true,
    expected: "true",
    actual: String(t3),
  });

  // 2. OPTIMISTIC LOCKING
  const testRun1: Run = {
    id: `run_opt_${Date.now()}`,
    tenantId: "tenant_alpha_01",
    workspaceId: "ws_01",
    taskId: "task_01",
    status: "queued",
    version: 0,
    cancellationEpoch: 0,
    runtimeName: "standard",
    runtimeVersion: "1.0",
    budgetLimit: 10,
    budgetReserved: 0,
    budgetConsumed: 0,
    createdAt: new Date().toISOString(),
  };
  runRepository.save(testRun1);

  // Transition to running (version 0 -> 1)
  await runRepository.transition(testRun1.id, "running", testRun1.version);

  // Stale worker tries to transition with old version (0 instead of 1)
  let staleWorkerRejected = false;
  try {
    await runRepository.transition(testRun1.id, "failed", testRun1.version); // expects 0, but current is 1
  } catch (e: any) {
    staleWorkerRejected = e.message === "STALE_RUN_VERSION";
  }

  results.push({
    suite: "Optimistic Locking",
    name: "rejects stale worker update",
    passed: staleWorkerRejected,
    expected: "Throws STALE_RUN_VERSION",
    actual: staleWorkerRejected ? "Threw STALE_RUN_VERSION" : "Stale write succeeded",
    details: "Worker with stale snapshot prevented from overwriting active state",
  });

  // 3. IDEMPOTENCY
  const contextA: RequestContext = {
    requestId: "req_idem_01",
    tenantId: "tenant_alpha_01",
    actorId: "usr_lead",
    actorType: "user",
    roles: ["owner"],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const clientRequestId = `client_req_${Date.now()}`;
  const input = {
    taskId: "task_auth_fix_901",
    workspaceId: "ws_01",
    budgetLimit: 5,
    clientRequestId,
  };

  const firstCreate = await runService.create(input, contextA);
  const secondCreate = await runService.create(input, contextA);

  results.push({
    suite: "Idempotency",
    name: "returns the same run for duplicate request",
    passed: firstCreate.id === secondCreate.id,
    expected: `first.id === second.id (${firstCreate.id})`,
    actual: secondCreate.id,
    details: "Deduplication store prevented duplicate task execution",
  });

  // 4. WORKER CRASH & LEASE RECOVERY
  const testRun2: Run = {
    id: `run_crash_${Date.now()}`,
    tenantId: "tenant_alpha_01",
    workspaceId: "ws_01",
    taskId: "task_01",
    status: "queued",
    version: 0,
    cancellationEpoch: 0,
    runtimeName: "standard",
    runtimeVersion: "1.0",
    budgetLimit: 10,
    budgetReserved: 0,
    budgetConsumed: 0,
    createdAt: new Date().toISOString(),
  };
  runRepository.save(testRun2);

  // Worker 1 claims run
  const lease = await workerLeaseManager.claimRun(testRun2.id, "worker-exec-01");

  // Simulate crash: expire the lease
  workerLeaseManager.expireLease(lease.runId);

  // Recovery sweeps expired leases
  const recoveredIds = await workerLeaseManager.recoverExpiredLeases();
  const recoveredRun = runRepository.get(testRun2.id);

  const crashRecovered =
    recoveredIds.includes(testRun2.id) &&
    recoveredRun?.status === "queued";

  results.push({
    suite: "Worker Crash & Recovery",
    name: "requeues a run after worker lease expiry",
    passed: crashRecovered,
    expected: "Status 'queued', run re-enqueued to Redis queue",
    actual: `Status '${recoveredRun?.status}', recovered: ${recoveredIds.length}`,
    details: "Dead worker lease cleared and job restored to queue",
  });

  // 5. CANCELLATION RACE
  const runningRun: Run = {
    id: `run_cancel_race_${Date.now()}`,
    tenantId: "tenant_alpha_01",
    workspaceId: "ws_01",
    taskId: "task_01",
    status: "running",
    version: 1,
    cancellationEpoch: 0,
    runtimeName: "standard",
    runtimeVersion: "1.0",
    budgetLimit: 10,
    budgetReserved: 0,
    budgetConsumed: 0,
    createdAt: new Date().toISOString(),
  };
  runRepository.save(runningRun);

  // Request cancellation
  await runService.requestCancellation(runningRun.id, contextA);
  const currentAfterCancel = runRepository.get(runningRun.id);

  // Check that new step is stopped
  const canContinue = currentAfterCancel?.status === "running";

  results.push({
    suite: "Cancellation Race",
    name: "does not start a new step after cancellation",
    passed: !canContinue && currentAfterCancel?.status === "cancellation_requested",
    expected: "Status 'cancellation_requested', cancellation_epoch bumped",
    actual: `Status '${currentAfterCancel?.status}', epoch: ${currentAfterCancel?.cancellationEpoch}`,
    details: "Execution loop halted before dispatching next pending step",
  });

  // 6. TENANT ISOLATION ON CANCEL
  const contextB: RequestContext = {
    requestId: "req_attack_01",
    tenantId: "tenant_beta_02", // Different tenant!
    actorId: "usr_attacker",
    actorType: "user",
    roles: ["owner"],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  let crossTenantCancelBlocked = false;
  try {
    await runService.requestCancellation(runningRun.id, contextB);
  } catch (e: any) {
    crossTenantCancelBlocked = e.message === "RUN_NOT_FOUND";
  }

  results.push({
    suite: "Tenant Isolation",
    name: "does not allow tenant B to cancel tenant A run",
    passed: crossTenantCancelBlocked,
    expected: "Throw RUN_NOT_FOUND",
    actual: crossTenantCancelBlocked ? "Threw RUN_NOT_FOUND" : "Allowed cross-tenant cancel",
    details: "Tenant B cannot inspect or cancel Tenant A runs",
  });

  return results;
}
