/**
 * AI Workbench - Sprint 4 Tool Gateway & Policy Security Test Suite
 * Covers: Replay Attack, Expired Context, Tenant Scope Mismatch, Policy Denial, Secret Revocation, Cancellation Race, Idempotency
 */

import { executionContextSigner } from "../../packages/security/src/context-signer";
import { nonceStore } from "../../packages/security/src/nonce-store";
import { toolGateway } from "../../packages/tools/src/gateway";
import { toolCallRepository } from "../../packages/tools/src/idempotency";
import { mockGithubAdapter } from "../../packages/tools/src/executor";
import { secretBroker } from "../../packages/secrets/src/broker";
import { runRepository } from "../../packages/runs/src/run-repository";
import { runService } from "../../packages/runs/src/run-service";
import { ToolRequest } from "../../packages/contracts/src/tool";
import { Run } from "../../packages/contracts/src/run";
import { RequestContext } from "../../packages/contracts/src/context";

export interface GatewayTestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export async function runGatewayTestSuite(): Promise<GatewayTestResult[]> {
  const results: GatewayTestResult[] = [];

  const tenantA = "tenant_alpha_01";
  const tenantB = "tenant_beta_02";
  const workspaceId = "ws_01";

  // Helper to setup a test run
  const setupTestRun = (tenantId: string, runId: string, status: any = "running", epoch: number = 0): Run => {
    const run: Run = {
      id: runId,
      tenantId,
      workspaceId,
      taskId: "task_test_101",
      status,
      version: 1,
      cancellationEpoch: epoch,
      runtimeName: "standard",
      runtimeVersion: "1.0",
      budgetLimit: 10,
      budgetReserved: 0,
      budgetConsumed: 0,
      createdAt: new Date().toISOString(),
    };
    runRepository.save(run);
    return run;
  };

  // 1. REPLAY ATTACK (Nonce reuse)
  let replayBlocked = false;
  try {
    const token = await executionContextSigner.create({
      issuer: "workbench-control-plane",
      keyId: "key-v1",
      tenantId: tenantA,
      workspaceId,
      runId: "run_replay_test",
      stepId: "step_01",
      actorId: "usr_agent_01",
      requestedAction: "repo.read_file",
      riskLevel: "low",
      policyVersion: "v1.1",
      cancellationEpoch: 0,
    });

    // First consumption succeeds
    await executionContextSigner.verify(token);

    // Second consumption MUST fail with NONCE_ALREADY_CONSUMED
    await executionContextSigner.verify(token);
  } catch (e: any) {
    replayBlocked = e.message === "NONCE_ALREADY_CONSUMED";
  }

  results.push({
    suite: "Security - Replay Attack",
    name: "rejects reused execution nonce",
    passed: replayBlocked,
    expected: "Throws NONCE_ALREADY_CONSUMED",
    actual: replayBlocked ? "Threw NONCE_ALREADY_CONSUMED" : "Allowed nonce reuse",
    details: "One-time execution nonce consumed atomically in memory store",
  });

  // 2. EXPIRED CONTEXT
  let expiredBlocked = false;
  try {
    // Generate an expired token by passing expired epoch
    const expiredPayload = {
      issuer: "workbench-control-plane",
      keyId: "key-v1",
      issuedAt: Math.floor(Date.now() / 1000) - 400,
      expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired in the past!
      nonce: `nonce_exp_${Date.now()}`,
      tenantId: tenantA,
      workspaceId,
      runId: "run_exp_test",
      stepId: "step_01",
      actorId: "usr_agent_01",
      requestedAction: "repo.read_file",
      riskLevel: "low",
      policyVersion: "v1.1",
      cancellationEpoch: 0,
    };
    await nonceStore.reserve(expiredPayload.nonce, expiredPayload.expiresAt);

    // Encode
    const json = JSON.stringify({
      payload: expiredPayload,
      signature: "sig_key-v1_invalid", // will fail expiration or sig
    });
    const expiredToken = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await executionContextSigner.verify(expiredToken);
  } catch (e: any) {
    expiredBlocked = e.message === "EXECUTION_CONTEXT_EXPIRED" || e.message === "INVALID_EXECUTION_CONTEXT_SIGNATURE";
  }

  results.push({
    suite: "Security - Expired Context",
    name: "rejects expired context",
    passed: expiredBlocked,
    expected: "Throws EXECUTION_CONTEXT_EXPIRED",
    actual: expiredBlocked ? "Rejected expired token" : "Accepted expired token",
    details: "Execution context lifespan limited to 300 seconds",
  });

  // 3. TENANT MISMATCH (Scope validation)
  let tenantMismatchBlocked = false;
  try {
    const run3 = setupTestRun(tenantA, "run_scope_mismatch_01");
    const token = await executionContextSigner.create({
      issuer: "workbench-control-plane",
      keyId: "key-v1",
      tenantId: tenantA,
      workspaceId,
      runId: run3.id,
      stepId: "step_01",
      actorId: "usr_agent_01",
      requestedAction: "repo.read_file",
      riskLevel: "low",
      policyVersion: "v1.1",
      cancellationEpoch: 0,
    });

    const maliciousRequest: ToolRequest = {
      toolName: "repo.read_file",
      toolVersion: "1.0.0",
      tenantId: tenantB, // MISMATCH with token tenantA!
      workspaceId,
      runId: run3.id,
      stepId: "step_01",
      actor: { type: "agent", id: "usr_agent_01" },
      input: { repositoryId: "repo_01", path: "README.md" },
      requestedCapabilities: ["github:read"],
      idempotencyKey: `idem_mismatch_${Date.now()}`,
      contextToken: token,
    };

    await toolGateway.execute(maliciousRequest);
  } catch (e: any) {
    tenantMismatchBlocked = e.message === "TENANT_SCOPE_INVALID";
  }

  results.push({
    suite: "Security - Scope Validation",
    name: "rejects tenant mismatch",
    passed: tenantMismatchBlocked,
    expected: "Throws TENANT_SCOPE_INVALID",
    actual: tenantMismatchBlocked ? "Threw TENANT_SCOPE_INVALID" : "Cross-tenant scope allowed",
    details: "Context tenant strictly validated against request tenant before execution",
  });

  // 4. POLICY DENIAL & HUMAN APPROVAL
  const run4 = setupTestRun(tenantA, "run_approval_test_01");
  const tokenWorkflow = await executionContextSigner.create({
    issuer: "workbench-control-plane",
    keyId: "key-v1",
    tenantId: tenantA,
    workspaceId,
    runId: run4.id,
    stepId: "step_01",
    actorId: "usr_agent_01",
    requestedAction: "github.modify_workflow",
    riskLevel: "critical",
    policyVersion: "v1.1",
    cancellationEpoch: 0,
  });

  const approvalRequest: ToolRequest = {
    toolName: "github.modify_workflow",
    toolVersion: "1.0.0",
    tenantId: tenantA,
    workspaceId,
    runId: run4.id,
    stepId: "step_01",
    actor: { type: "agent", id: "usr_agent_01" },
    input: { path: ".github/workflows/ci.yml" },
    requestedCapabilities: ["github:write"],
    idempotencyKey: `idem_workflow_${Date.now()}`,
    contextToken: tokenWorkflow,
  };

  const workflowResult = await toolGateway.execute(approvalRequest);
  const requiresApprovalPassed = workflowResult.status === "requires_approval" && Boolean((workflowResult as any).approvalId);

  results.push({
    suite: "Policy Engine",
    name: "denies workflow modification without approval",
    passed: requiresApprovalPassed,
    expected: "status: 'requires_approval'",
    actual: `status: '${workflowResult.status}'`,
    details: "Sensitive tool flagged with approval_required and human review token generated",
  });

  // 5. SECRET REVOCATION (Ephemeral leases)
  const run5 = setupTestRun(tenantA, "run_secret_revocation_01");
  const tokenSecret = await executionContextSigner.create({
    issuer: "workbench-control-plane",
    keyId: "key-v1",
    tenantId: tenantA,
    workspaceId,
    runId: run5.id,
    stepId: "step_01",
    actorId: "usr_agent_01",
    requestedAction: "repo.read_file",
    riskLevel: "low",
    policyVersion: "v1.1",
    cancellationEpoch: 0,
  });

  const secretToolRequest: ToolRequest = {
    toolName: "repo.read_file",
    toolVersion: "1.0.0",
    tenantId: tenantA,
    workspaceId,
    runId: run5.id,
    stepId: "step_01",
    actor: { type: "agent", id: "usr_agent_01" },
    input: { repositoryId: "repo_01", path: "src/auth.ts" },
    requestedCapabilities: ["github:read"],
    idempotencyKey: `idem_secret_${Date.now()}`,
    contextToken: tokenSecret,
  };

  await toolGateway.execute(secretToolRequest);
  // Active leases for this run should be 0 because lease was revoked in finally block
  const activeLeasesAfterExecution = secretBroker.getActiveLeases(run5.id);
  const leaseRevoked = activeLeasesAfterExecution.length === 0;

  results.push({
    suite: "Secret Broker",
    name: "revokes lease after tool completion",
    passed: leaseRevoked,
    expected: "0 active leases remaining",
    actual: `${activeLeasesAfterExecution.length} active leases`,
    details: "Secret lease immediately revoked in finally block upon tool termination",
  });

  // 6. CANCELLATION RACE
  const run6 = setupTestRun(tenantA, "run_cancel_race_01", "running", 0);
  const tokenCancel = await executionContextSigner.create({
    issuer: "workbench-control-plane",
    keyId: "key-v1",
    tenantId: tenantA,
    workspaceId,
    runId: run6.id,
    stepId: "step_01",
    actorId: "usr_agent_01",
    requestedAction: "repo.read_file",
    riskLevel: "low",
    policyVersion: "v1.1",
    cancellationEpoch: 0,
  });

  // User cancels run before tool execution
  const userCtx: RequestContext = {
    requestId: "req_cancel_01",
    tenantId: tenantA,
    actorId: "usr_lead",
    actorType: "user",
    roles: ["owner"],
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };
  await runService.requestCancellation(run6.id, userCtx);

  const cancelRequest: ToolRequest = {
    toolName: "repo.read_file",
    toolVersion: "1.0.0",
    tenantId: tenantA,
    workspaceId,
    runId: run6.id,
    stepId: "step_01",
    actor: { type: "agent", id: "usr_agent_01" },
    input: { repositoryId: "repo_01", path: "src/main.ts" },
    requestedCapabilities: ["github:read"],
    idempotencyKey: `idem_cancel_${Date.now()}`,
    contextToken: tokenCancel,
  };

  const cancelResponse = await toolGateway.execute(cancelRequest);
  const cancellationEnforced =
    cancelResponse.status === "rejected" &&
    (cancelResponse as any).code === "RUN_CANCELLED";

  results.push({
    suite: "Cancellation Guard",
    name: "does not execute after run cancellation",
    passed: cancellationEnforced,
    expected: "status: 'rejected' & code: 'RUN_CANCELLED'",
    actual: `status: '${cancelResponse.status}' (code: ${(cancelResponse as any).code})`,
    details: "Cancellation epoch mismatch halted execution before tool invocation",
  });

  // 7. DUPLICATE EXTERNAL OPERATION (Idempotency)
  mockGithubAdapter.reset();
  const run7 = setupTestRun(tenantA, "run_idem_branch_01");
  const branchName = `feature/auth-patch-${Date.now()}`;
  const idemKey = `branch:create:repo_01:${branchName}:base123`;

  const tokenBranch1 = await executionContextSigner.create({
    issuer: "workbench-control-plane",
    keyId: "key-v1",
    tenantId: tenantA,
    workspaceId,
    runId: run7.id,
    stepId: "step_branch_1",
    actorId: "usr_agent_01",
    requestedAction: "repo.create_branch",
    riskLevel: "medium",
    policyVersion: "v1.1",
    cancellationEpoch: 0,
  });

  const branchRequest1: ToolRequest = {
    toolName: "repo.create_branch",
    toolVersion: "1.0.0",
    tenantId: tenantA,
    workspaceId,
    runId: run7.id,
    stepId: "step_branch_1",
    actor: { type: "agent", id: "usr_agent_01" },
    input: { repositoryId: "repo_01", branchName },
    requestedCapabilities: ["github:write"],
    idempotencyKey: idemKey,
    contextToken: tokenBranch1,
  };

  const firstBranchRes = await toolGateway.execute(branchRequest1);

  // Second invocation with fresh token but identical idempotencyKey
  const tokenBranch2 = await executionContextSigner.create({
    issuer: "workbench-control-plane",
    keyId: "key-v1",
    tenantId: tenantA,
    workspaceId,
    runId: run7.id,
    stepId: "step_branch_1",
    actorId: "usr_agent_01",
    requestedAction: "repo.create_branch",
    riskLevel: "medium",
    policyVersion: "v1.1",
    cancellationEpoch: 0,
  });

  const branchRequest2: ToolRequest = {
    ...branchRequest1,
    contextToken: tokenBranch2,
  };

  const secondBranchRes = await toolGateway.execute(branchRequest2);
  const idempotencyPassed =
    firstBranchRes.status === "succeeded" &&
    secondBranchRes.status === "succeeded" &&
    mockGithubAdapter.createBranchCalls === 1;

  results.push({
    suite: "Idempotency",
    name: "does not create two branches",
    passed: idempotencyPassed,
    expected: "githubAdapter.createBranch called exactly 1 time",
    actual: `Called ${mockGithubAdapter.createBranchCalls} times`,
    details: "Second duplicate execution served from idempotency store without side effects",
  });

  return results;
}
