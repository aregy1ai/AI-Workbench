/**
 * AI Workbench - Security & Multi-Tenant Isolation Test Suite
 * Sprint 1: Security Verification Gate
 */

import { ContextSigner, assertContext } from "../../packages/auth/src/context";
import { authorization, assertPermission } from "../../packages/authorization/src/authorize";
import { runStateMachine } from "../../packages/runs/src/state-machine";
import { Run } from "../../packages/contracts/src/run";
import { WorkspaceRepository } from "../../packages/database/src/workspace-repository";
import { RequestContext } from "../../packages/contracts/src/context";

export interface TestReport {
  testName: string;
  category: "Multi-Tenancy" | "Replay Defense" | "State Locking" | "Cancellation Epoch" | "RLS Isolation" | "Authorization";
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runSecurityTestSuite(): TestReport[] {
  const reports: TestReport[] = [];

  const tenantA = "tenant_alpha_01";
  const tenantB = "tenant_beta_02";

  // TEST 1: Cross-Tenant Access Denial
  const scopeResult = authorization.assertTenantScope(tenantA, tenantB);
  reports.push({
    testName: "Cross-Tenant Resource Isolation",
    category: "Multi-Tenancy",
    passed: !scopeResult.ok && scopeResult.error.code === "TENANT_SCOPE_INVALID",
    expected: "TENANT_SCOPE_INVALID error returned",
    actual: scopeResult.ok ? "Allowed" : scopeResult.error.code,
    details: "Tenant Alpha attempted to scope Tenant Beta resources directly",
  });

  // TEST 2: does not return another tenant workspaces (RLS filter)
  const repo = new WorkspaceRepository();
  const contextA: RequestContext = {
    requestId: "req_test_01",
    tenantId: tenantA,
    actorId: "usr_alice",
    actorType: "user",
    roles: ["developer"],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };
  const contextB: RequestContext = {
    requestId: "req_test_02",
    tenantId: tenantB,
    actorId: "usr_bob",
    actorType: "user",
    roles: ["developer"],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  // Seed workspaces
  repo.createSync(contextA, "A workspace");
  repo.createSync(contextB, "B workspace");

  let listAPassed = false;
  try {
    const listA = repo.listSync(contextA);
    // synchronously resolved in mock
    listAPassed = Array.isArray(listA) && listA.length === 1 && listA[0]?.name === "A workspace";
  } catch (e) {
    listAPassed = false;
  }

  reports.push({
    testName: "Does not return another tenant workspaces",
    category: "RLS Isolation",
    passed: listAPassed,
    expected: "Only Tenant A workspaces returned (Length 1, Name 'A workspace')",
    actual: listAPassed ? "Only Tenant A workspaces returned" : "Cross-tenant leakage detected",
    details: "Queried workspaces with Tenant A context while Tenant B workspaces exist",
  });

  // TEST 3: rejects inserts into another tenant
  let insertRejected = false;
  try {
    repo.createForTenantSync(contextA, tenantB, "Malicious B workspace");
  } catch (e: any) {
    insertRejected = e.message.includes("TENANT_SCOPE_INVALID");
  }

  reports.push({
    testName: "Rejects inserts into another tenant",
    category: "RLS Isolation",
    passed: insertRejected,
    expected: "Throw TENANT_SCOPE_INVALID error",
    actual: insertRejected ? "TENANT_SCOPE_INVALID thrown" : "Insert allowed",
    details: "Tenant A attempted to insert row with tenant_id = Tenant B",
  });

  // TEST 4: fails closed without tenant context
  let failClosedPassed = false;
  try {
    assertContext({
      requestId: "req_bad",
      tenantId: "", // empty
      actorId: "usr_anon",
      actorType: "user",
      roles: [],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
  } catch (e: any) {
    failClosedPassed = e.message === "TENANT_SCOPE_INVALID";
  }

  reports.push({
    testName: "Fails closed without tenant context",
    category: "Multi-Tenancy",
    passed: failClosedPassed,
    expected: "Throw TENANT_SCOPE_INVALID error",
    actual: failClosedPassed ? "TENANT_SCOPE_INVALID thrown" : "Allowed without tenant",
    details: "Missing tenant_id fails closed before touching database layer",
  });

  // TEST 5: Authorization asserts role permission
  let authDenied = false;
  try {
    assertPermission(["viewer"], "workspace:write");
  } catch (e: any) {
    authDenied = e.message === "FORBIDDEN";
  }

  reports.push({
    testName: "Authorization rejects unauthorized role",
    category: "Authorization",
    passed: authDenied,
    expected: "Throw FORBIDDEN when viewer attempts workspace:write",
    actual: authDenied ? "FORBIDDEN thrown" : "Unauthorized action permitted",
    details: "Role 'viewer' denied permission 'workspace:write'",
  });

  // TEST 6: Replay Attack Defense via Nonce
  const signer = new ContextSigner("test-secret", "k-v1");
  const signedContext = signer.sign({
    tenantId: tenantA,
    workspaceId: "ws_01",
    runId: "run_01",
    stepId: "step_01",
    actorId: "actor_01",
    requestedAction: "repo.read_file",
    riskLevel: "low",
    policyVersion: "1.0.0",
    cancellationEpoch: 0,
  });

  const firstVerify = signer.verify(signedContext);
  const replayVerify = signer.verify(signedContext);

  reports.push({
    testName: "Replay Attack Prevention via Nonce Cache",
    category: "Replay Defense",
    passed: firstVerify.valid && !replayVerify.valid && replayVerify.reason === "REPLAY_ATTACK_DETECTED",
    expected: "REPLAY_ATTACK_DETECTED on second invocation",
    actual: replayVerify.reason || "Valid",
    details: `Nonce: ${signedContext.nonce}`,
  });

  // TEST 7: Stale Cancellation Epoch Defense
  const staleEpochContext = signer.sign({
    tenantId: tenantA,
    workspaceId: "ws_01",
    runId: "run_02",
    stepId: "step_02",
    actorId: "actor_01",
    requestedAction: "workspace.run_tests",
    riskLevel: "medium",
    policyVersion: "1.0.0",
    cancellationEpoch: 0,
  });

  const epochVerify = signer.verify(staleEpochContext, 1);

  reports.push({
    testName: "Stale Cancellation Epoch Invalidation",
    category: "Cancellation Epoch",
    passed: !epochVerify.valid && epochVerify.reason === "STALE_CANCELLATION_EPOCH",
    expected: "STALE_CANCELLATION_EPOCH rejected",
    actual: epochVerify.reason || "Valid",
    details: "Tool execution context generated before cancellation was denied",
  });

  // TEST 8: Optimistic Concurrency Locking
  const testRun: Run = {
    id: "run_race_01",
    tenantId: tenantA,
    workspaceId: "ws_01",
    taskId: "task_01",
    status: "running",
    cancellationEpoch: 0,
    version: 5,
    runtimeName: "adapter",
    runtimeVersion: "1.0",
    budgetLimit: 10,
    budgetReserved: 0,
    budgetConsumed: 0,
    createdAt: new Date().toISOString(),
  };

  const staleTransition = runStateMachine.transition(testRun, "succeeded", 4);

  reports.push({
    testName: "Optimistic Version Locking (Prevent Race Updates)",
    category: "State Locking",
    passed: !staleTransition.ok && staleTransition.error.code === "RUN_VERSION_CONFLICT",
    expected: "RUN_VERSION_CONFLICT error returned",
    actual: staleTransition.ok ? "Allowed" : staleTransition.error.code,
    details: "Worker with stale snapshot rejected from modifying run state",
  });

  return reports;
}
